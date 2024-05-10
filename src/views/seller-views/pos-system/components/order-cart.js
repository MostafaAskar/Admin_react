import React, { useState } from 'react';
import {
  CheckOutlined,
  DeleteOutlined,
  MinusOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import {
  Button,
  Card,
  Col,
  Divider,
  Form,
  Image,
  Input,
  Row,
  Space,
  Spin,
} from 'antd';
import { batch, shallowEqual, useDispatch, useSelector } from 'react-redux';
import {
  addToCart,
  clearCart,
  removeFromCart,
  reduceCart,
  setCartShops,
  clearCartShops,
  setCartTotal,
  addCoupon,
  verifyCoupon,
  removeBag,
  setCartData,
  setCartOrder,
} from 'redux/slices/cart';
import getImage from 'helpers/getImage';
import useDidUpdate from 'helpers/useDidUpdate';
import orderService from 'services/seller/order';
import invokableService from 'services/rest/invokable';
import { useTranslation } from 'react-i18next';
import numberToPrice from 'helpers/numberToPrice';
import { getCartData, getCartItems } from 'redux/selectors/cartSelector';
import PreviewInfo from './preview-info';
import { toast } from 'react-toastify';
import { fetchSellerProducts } from 'redux/slices/product';
import moment from 'moment';
import QueryString from 'qs';
import { useLocation } from 'react-router-dom';
import RiveResult from 'components/rive-result';

export default function OrderCart() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const { cartItems, cartShops, currentBag, total, coupons, currency } =
    useSelector((state) => state.cart, shallowEqual);
  const filteredCartItems = useSelector((state) => getCartItems(state.cart));
  const data = useSelector((state) => getCartData(state.cart), shallowEqual);
  const [loading, setLoading] = useState(false);
  const [showInvoice, setShowInvoice] = useState(null);
  const [loadingCoupon, setLoadingCoupon] = useState(null);
  const [form] = Form.useForm();
  const { myShop: shop } = useSelector((state) => state.myShop, shallowEqual);
  const locat = useLocation();
  const delivery_type = locat?.state?.delivery_type;

  const deleteCard = (e) => dispatch(removeFromCart(e));
  const clearAll = () => {
    dispatch(clearCart());
    if (currentBag !== 0) {
      dispatch(removeBag(currentBag));
    }
  };

  const increment = (item) => {
    if (item.quantity === item?.stock?.quantity) {
      return;
    }
    if (item.quantity === item.max_qty) {
      return;
    }
    dispatch(addToCart({ ...item, quantity: 1 }));
  };

  const decrement = (item) => {
    if (item.quantity === 1) {
      return;
    }
    if (item.quantity <= item.min_qty) {
      return;
    }
    dispatch(reduceCart({ ...item, quantity: 1 }));
  };

  function formatProducts(list) {
    const products = list.map((item) => ({
      quantity: item.quantity,
      stock_id: item.stockID ? item.stockID?.id : item.stock?.id,
    }));

    const result = {
      products,
      currency_id: currency?.id,
      coupon: data?.coupon?.coupon,
      shop_id: shop.id,
      delivery_type: data?.deliveries?.label?.toLowerCase(),
      delivery_point_id:
        data?.delivery_type === 0 ? data?.delivery_point?.value : undefined,
      delivery_price_id:
        data?.delivery_type === 1 ? data?.delivery_price_id : undefined,
    };
    return QueryString.stringify(result, { addQueryPrefix: true });
  }

  useDidUpdate(() => {
    dispatch(
      fetchSellerProducts({
        perPage: 12,
        currency_id: currency?.id,
        status: 'published',
        active: 1,
      }),
    );
    if (filteredCartItems.length) {
      productCalculate();
    }
  }, [currency]);

  useDidUpdate(() => {
    if (filteredCartItems.length) {
      productCalculate();
    } else {
      dispatch(clearCartShops());
    }
  }, [cartItems, currentBag, data?.address, currency, data?.coupon]);

  function productCalculate() {
    const products = formatProducts(filteredCartItems);

    setLoading(true);
    orderService
      .calculate(products)
      .then(({ data }) => {
        const items = data?.shops
          ?.flatMap((shop) => shop.stocks)
          ?.map((item) => ({
            ...filteredCartItems.find((el) => el.id === item.id),
            ...item,
            ...item.stock.countable,
            stock: item.stock.stock_extras,
            stocks: item.stock.stock_extras,
            stockID: item.stock,
          }));
        dispatch(setCartShops(items));
        const orderData = {
          product_total: data?.price,
          tax: data?.total_tax,
          shop_tax: data?.total_shop_tax,
          order_total: data?.total_price,
          delivery_fee: data?.delivery_fee?.reduce(
            (total, item) => (total += item?.price ?? 0),
            0,
          ),
          service_fee: data?.service_fee,
          coupon: data?.coupon_price,
          discount: data?.total_discount,
        };
        dispatch(setCartTotal(orderData));
      })
      .finally(() => setLoading(false));
  }

  const handleSave = (id) => {
    setShowInvoice(id);
    dispatch(
      fetchSellerProducts({
        perPage: 12,
        currency_id: currency?.id,
        status: 'published',
        active: 1,
      }),
    );
  };

  const handleCloseInvoice = () => {
    setShowInvoice(null);
    clearAll();
    toast.success(t('successfully.closed'));
  };

  function handleCheckCoupon(shopId) {
    let coupon = coupons.find((item) => item.shop_id === shopId);
    if (!coupon) {
      return;
    }
    setLoadingCoupon(shopId);
    invokableService
      .checkCoupon(coupon)
      .then((res) => {
        dispatch(setCartData({ coupon, bag_id: currentBag }));
        dispatch(
          verifyCoupon({
            shop_id: shopId,
            price: res.data.price,
            verified: true,
          }),
        );
      })
      .catch(() =>
        dispatch(
          verifyCoupon({
            shop_id: shopId,
            price: 0,
            verified: false,
          }),
        ),
      )
      .finally(() => setLoadingCoupon(null));
  }

  const handleClick = () => {
    if (!currency && !delivery_type) {
      toast.warning(t('please.select.currency'));
      return;
    }
    if (!data.address && data?.delivery_type === 1) {
      toast.warning(t('please.select.address'));
      return;
    }
    if (!data.country && data?.delivery_type === 1) {
      toast.warning(t('please.select.country'));
      return;
    }
    if (!data.street_house_number && data?.delivery_type === 1) {
      toast.warning(t('please.enter.house.number'));
      return;
    }
    if (!data.zip_code && data?.delivery_type === 1) {
      toast.warning(t('please.enter.zipcode'));
      return;
    }
    if (!data.delivery_point && data?.delivery_type === 0) {
      toast.warning(t('please.select.delivery.point'));
      return;
    }
    if (!data.delivery_time && !delivery_type) {
      toast.warning(t('shop.closed'));
      return;
    }
    if (!data.delivery_date && !delivery_type) {
      toast.warning(t('please.select.deliveryDate'));
      return;
    }
    setLoading(true);
    const products = cartShops?.map((cart) => ({
      stock_id: cart.stockID.id,
      quantity: cart.quantity,
      bonus: cart.bonus,
    }));
    const defaultBody = {
      user_id: data.user?.value,
      currency_id: currency?.id,
      rate: currency.rate,
      payment_id: data.paymentType?.value,
      delivery_point_id:
        data?.delivery_type === 0 ? data?.delivery_point?.value : undefined,
      delivery_date: `${data.delivery_date} ${moment(
        data.delivery_time,
        'HH:mm',
      ).format('HH:mm')}`,
      delivery_type: data.deliveries.label.toLowerCase(),
      coupon: {
        [shop?.id]: coupons[0]?.coupon,
      },
      data: [
        {
          shop_id: shop?.id,
          products,
        },
      ],
      tax: total.order_tax,
      delivery_price_id:
        data?.delivery_type === 1 ? data?.delivery_price_id : undefined,
      address:
        data?.delivery_type === 1
          ? {
              address: data.address?.address,
              country_id: data?.country?.value,
              city_id: data?.city?.value,
              street_house_number: data?.street_house_number,
              zip_code: data?.zip_code,
            }
          : undefined,
      location:
        data?.delivery_type === 1
          ? {
              latitude: data.address?.lat,
              longitude: data.address?.lng,
            }
          : undefined,

      products: products,
      phone: data?.phone?.toString(),
    };

    const dineInBody = {
      currency_id: currency?.id,
      delivery_type: delivery_type,
      payment_type: data.paymentType?.label,
      products: products,
      shop_id: shop.id,
    };

    if (!coupons[0]?.coupon?.length) {
      delete defaultBody.coupon;
    }

    const body = delivery_type ? dineInBody : defaultBody;

    orderService
      .create(body)
      .then((response) => {
        batch(() => {
          dispatch(setCartOrder(response?.data));
          dispatch(clearCart());
        });
        setShowInvoice(true);
        form.resetFields();
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  };

  return (
    <Card>
      {loading && (
        <div className='loader'>
          <Spin />
        </div>
      )}
      <div className='card-save'>
        {cartShops.map((item) => (
          <div>
            {item.bonus !== true ? (
              <div className='custom-cart-container' key={item.id}>
                <Row className='product-row'>
                  <Image
                    width={70}
                    height='auto'
                    src={getImage(item.img)}
                    preview
                    placeholder
                    className='rounded'
                  />
                  <Col span={18} className='product-col'>
                    <div>
                      <span className='product-name'>
                        {item?.translation?.title}
                      </span>
                      <br />
                      <Space wrap className='mt-2'>
                        {item?.stock?.map((el, idj) => {
                          if (el?.group?.type === 'color') {
                            return (
                              <Space>
                                {t('color')}:
                                <div
                                  className='extras-color'
                                  style={{
                                    backgroundColor: el?.value?.value,
                                  }}
                                ></div>
                              </Space>
                            );
                          }
                          return (
                            <Space>
                              <span>{el?.group?.translation?.title}:</span>
                              <span
                                key={idj + '-' + el.value?.value}
                                className='extras-text rounded pr-2 pl-2'
                              >
                                {el.value?.value}
                              </span>
                            </Space>
                          );
                        })}
                      </Space>
                      <br />
                      <Space wrap className='mt-2'>
                        {item.addons?.map((addon) => {
                          return (
                            <span className='extras-text rounded pr-2 pl-2'>
                              {addon?.countable?.translation?.title} x{' '}
                              {addon.quantity}
                            </span>
                          );
                        })}
                      </Space>
                      <div className='product-counter'>
                        <span>
                          {numberToPrice(
                            item?.total_price || item?.price,
                            currency?.symbol,
                          )}
                        </span>

                        <div className='count'>
                          <Button
                            className='button-counter'
                            shape='circle'
                            icon={<MinusOutlined size={14} />}
                            onClick={() => decrement(item)}
                          />
                          <span>
                            {item?.quantity *
                              (item?.stock?.product?.interval || 1)}
                            {item?.stock?.product?.unit?.translation?.title}
                          </span>
                          <Button
                            className='button-counter'
                            shape='circle'
                            icon={<PlusOutlined size={14} />}
                            onClick={() => increment(item)}
                          />
                          <Button
                            className='button-counter'
                            shape='circle'
                            onClick={() => deleteCard(item)}
                            icon={<DeleteOutlined size={14} />}
                          />
                        </div>
                      </div>
                    </div>
                  </Col>
                </Row>
              </div>
            ) : (
              <>
                <h4 className='mt-2'>{t('bonus.product')}</h4>
                <div className='custom-cart-container' key={item.id}>
                  <Row className='product-row'>
                    <Image
                      width={70}
                      height='auto'
                      src={getImage(item.img)}
                      preview
                      placeholder
                      className='rounded'
                    />
                    <Col span={18} className='product-col'>
                      <div>
                        <span className='product-name'>
                          {item?.translation?.title}
                        </span>
                        <br />
                        <Space wrap className='mt-2'>
                          {item?.stock?.map((el) => {
                            if (el?.group?.type === 'color') {
                              return (
                                <Space>
                                  {t('color')}:
                                  <div
                                    className='extras-color'
                                    style={{
                                      backgroundColor: el?.value?.value,
                                    }}
                                  ></div>
                                </Space>
                              );
                            }
                            return (
                              <Space>
                                <span>{el?.group?.translation?.title}:</span>
                                <span
                                  key={el.value?.value}
                                  className='extras-text rounded pr-2 pl-2'
                                >
                                  {el.value?.value}
                                </span>
                              </Space>
                            );
                          })}
                        </Space>
                        <br />
                        <Space wrap className='mt-2'>
                          {item.addons?.map((addon) => {
                            return (
                              <span className='extras-text rounded pr-2 pl-2'>
                                {addon?.countable?.translation?.title} x{' '}
                                {addon.quantity}
                              </span>
                            );
                          })}
                        </Space>
                        <div className='product-counter'>
                          <span>
                            {numberToPrice(
                              item?.total_price || item?.price,
                              currency?.symbol,
                            )}
                          </span>

                          <div className='count'>
                            <Button
                              className='button-counter'
                              shape='circle'
                              icon={<MinusOutlined size={14} />}
                              onClick={() => decrement(item)}
                              disabled
                            />
                            <span>
                              {item?.quantity *
                                (item?.stock?.product?.interval || 1)}
                              {item?.stock?.product?.unit?.translation?.title}
                            </span>
                            <Button
                              className='button-counter'
                              shape='circle'
                              icon={<PlusOutlined size={14} />}
                              onClick={() => increment(item)}
                              disabled
                            />
                          </div>
                        </div>
                      </div>
                    </Col>
                  </Row>
                </div>
              </>
            )}
          </div>
        ))}
        {cartShops.length ? (
          <div className='d-flex my-3'>
            <Input
              placeholder={t('coupon')}
              className='w-100 mr-2'
              addonAfter={
                coupons.find((el) => el.shop_id === cartShops[0].shop_id)
                  ?.verified ? (
                  <CheckOutlined style={{ color: '#18a695' }} />
                ) : null
              }
              defaultValue={
                coupons.find((el) => el.shop_id === cartShops[0].shop_id)
                  ?.coupon
              }
              onBlur={(event) =>
                dispatch(
                  addCoupon({
                    coupon: event.target.value,
                    user_id: data.user?.value,
                    shop_id: cartShops[0].shop_id,
                    verified: false,
                  }),
                )
              }
            />
            <Button
              onClick={() => handleCheckCoupon(cartShops[0].shop_id)}
              loading={loadingCoupon === cartShops[0].shop_id}
            >
              {t('check.coupon')}
            </Button>
          </div>
        ) : (
          <div>
            <RiveResult id='nosell' />
            <p style={{ textAlign: 'center' }}>{t('empty.cart')}</p>
          </div>
        )}

        {!cartShops?.length && <Divider />}

        <Row className='all-price-row'>
          <Col span={24} className='col'>
            <div className='all-price-container'>
              <span>{t('products')}</span>
              <span>
                {numberToPrice(total.product_total, currency?.symbol)}
              </span>
            </div>
            <div className='all-price-container'>
              <span>{t('delivery.fee')}</span>
              <span>{numberToPrice(total.delivery_fee, currency?.symbol)}</span>
            </div>
            <div className='all-price-container'>
              <span>{t('service.fee')}</span>
              <span>{numberToPrice(total.service_fee, currency?.symbol)}</span>
            </div>
            <div className='all-price-container'>
              <span>{t('tax')}</span>
              <span>{numberToPrice(total.tax, currency?.symbol)}</span>
            </div>
            <div className='all-price-container'>
              <span>{t('discount')}</span>
              <span>- {numberToPrice(total.discount, currency?.symbol)}</span>
            </div>
            <div className='all-price-container'>
              <span>{t('coupon')}</span>
              <span>- {numberToPrice(total.coupon, currency?.symbol)}</span>
            </div>
          </Col>
        </Row>

        <Row className='submit-row'>
          <Col span={14} className='col'>
            <span>{t('total.amount')}</span>
            <span>{numberToPrice(total.order_total, currency?.symbol)}</span>
          </Col>
          <Col className='col2'>
            <Button
              type='primary'
              onClick={() => handleClick()}
              disabled={!cartShops.length}
            >
              {t('place.order')}
            </Button>
          </Col>
        </Row>
      </div>
      {showInvoice ? <PreviewInfo handleClose={handleCloseInvoice} /> : ''}
    </Card>
  );
}
