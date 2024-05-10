import React, { useState } from 'react';
import {
  Card,
  Col,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Row,
  Select,
} from 'antd';
import { shallowEqual, useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import moment from 'moment';
import { getCartData } from 'redux/selectors/cartSelector';
import { setCartData } from 'redux/slices/cart';
import { DebounceSelect } from 'components/search';
import cityService from 'services/deliveryzone/city';
import countryService from 'services/deliveryzone/country';
import deliveryPointService from 'services/delivery-point';
import { toast } from 'react-toastify';
import PosUserAddress from './pos-user-address';
import useDidUpdate from 'helpers/useDidUpdate';
import deliveryPriceService from 'services/delivery-price';

const DeliveryInfo = ({ form }) => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const data = useSelector((state) => getCartData(state.cart));
  const { myShop: shop } = useSelector((state) => state.myShop, shallowEqual);
  const { currentBag } = useSelector((state) => state.cart, shallowEqual);
  const cartData = useSelector((state) => getCartData(state.cart));
  const [addressModal, setAddressModal] = useState(null);

  const filter = shop?.shop_closed_date?.map((date) => date.day);

  function disabledDate(current) {
    const a = filter?.find(
      (date) => date === moment(current).format('YYYY-MM-DD'),
    );
    const b = moment().add(-1, 'days') >= current;
    if (a) {
      return a;
    } else {
      return b;
    }
  }

  const range = (start, end) => {
    const x = parseInt(start);
    const y = parseInt(end);
    const number = [
      0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
      21, 22, 23, 24,
    ];
    for (let i = x; i <= y; i++) {
      delete number[i];
    }
    return number;
  };

  const disabledDateTime = () => ({
    disabledHours: () =>
      range(
        moment(cartData?.delivery_date).format('YYYYMMDD') ===
          moment(new Date()).format('YYYYMMDD')
          ? moment(new Date()).add(1, 'hour').format('HH')
          : 0,
        24,
      ),
    disabledMinutes: () => [],
    disabledSeconds: () => [],
  });

  const delivery = [
    {
      label: 'delivery',
      value: 1,
      key: 1,
    },
    {
      label: 'point',
      value: 0,
      key: 0,
    },
  ];

  const setDeliveryPrice = (delivery) =>
    dispatch(setCartData({ delivery_fee: delivery.value, bag_id: currentBag }));

  const fetchDeliveryPoints = (search) => {
    const params = {
      search,
      perPage: 10,
      page: 1,
    };

    return deliveryPointService.get(params).then(({ data }) =>
      data?.flatMap((item) => ({
        label: item?.translation?.title,
        value: item?.id,
        key: item?.id,
      })),
    );
  };

  const fetchCountries = (search) => {
    const params = {
      search,
      perPage: 10,
      page: 1,
      has_price: 1,
    };

    return countryService.get(params).then(({ data }) =>
      data?.flatMap((item) => ({
        label: item?.translation?.title,
        value: item?.id,
        key: item?.id,
      })),
    );
  };

  const fetchCities = (search) => {
    const params = {
      search,
      perPage: 10,
      page: 1,
      country_id: cartData?.country?.value,
      has_price: 1,
    };

    return cityService.get(params).then(({ data }) =>
      data?.flatMap((item) => ({
        label: item?.translation?.title,
        value: item?.id,
        key: item?.id,
      })),
    );
  };

  const goToAddClientAddress = () => {
    if (!data.userUuid) {
      toast.warning(t('please.select.client'));
      return;
    }
    setAddressModal(data.userUuid);
  };

  useDidUpdate(() => {
    if (cartData?.country?.value && cartData?.city?.value) {
      const body = {
        country_id: cartData?.country?.value,
        city_id: cartData?.city?.value,
      };
      deliveryPriceService.get(body).then(({ data }) => {
        dispatch(
          setCartData({ delivery_price_id: data?.[0]?.id, bag_id: currentBag }),
        );
      });
    }
  }, [cartData?.country?.value, cartData?.city?.value]);

  return (
    <Card title={t('shipping.info')} className='p-0'>
      <Row gutter={12}>
        <Col span={24}>
          <Form.Item
            name='delivery'
            label={t('delivery')}
            rules={[{ required: true, message: t('required') }]}
          >
            <Select
              placeholder={t('delivery.type')}
              options={delivery}
              labelInValue
              onSelect={setDeliveryPrice}
              onChange={(deliveries) =>
                dispatch(
                  setCartData({
                    delivery_type: deliveries.value,
                    deliveries,
                    bag_id: currentBag,
                  }),
                )
              }
            />
          </Form.Item>
        </Col>
        {cartData?.deliveries?.value === 1 && (
          <>
            <Col span={12}>
              <Form.Item
                name='country'
                label={t('country')}
                rules={[
                  {
                    required: true,
                    message: t('required'),
                  },
                ]}
              >
                <DebounceSelect
                  fetchOptions={fetchCountries}
                  placeholder={t('select.country')}
                  onChange={(country) =>
                    dispatch(
                      setCartData({
                        country,
                        bag_id: currentBag,
                      }),
                    )
                  }
                  onClear={() => {
                    form.setFieldsValue({ city: [] });
                    dispatch(
                      setCartData({
                        country: null,
                        city: null,
                        bag_id: currentBag,
                      }),
                    );
                  }}
                  autoComplete='none'
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name='city' label={t('city')}>
                <DebounceSelect
                  fetchOptions={fetchCities}
                  placeholder={t('select.city')}
                  refetchOptions={true}
                  disabled={!cartData?.country}
                  onChange={(city) =>
                    dispatch(
                      setCartData({
                        city,
                        bag_id: currentBag,
                      }),
                    )
                  }
                  autoComplete='none'
                />
              </Form.Item>
            </Col>

            <Col span={12}>
              <Form.Item
                name='home_number'
                label={t('home.number')}
                rules={[
                  {
                    required: true,
                    message: t('required'),
                  },
                ]}
              >
                <InputNumber
                  placeholder={t('home.number')}
                  min={0}
                  className='w-100'
                  value={cartData?.street_house_number}
                  onChange={(value) =>
                    dispatch(
                      setCartData({
                        street_house_number: value,
                        bag_id: currentBag,
                      }),
                    )
                  }
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name='zip_code'
                label={t('zip.code')}
                rules={[
                  {
                    required: true,
                    message: t('required'),
                  },
                ]}
              >
                <Input
                  placeholder={t('zip.code')}
                  className='w-100'
                  value={cartData?.zip_code}
                  onChange={(value) =>
                    dispatch(
                      setCartData({
                        zip_code: value.target.value,
                        bag_id: currentBag,
                      }),
                    )
                  }
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label={t('address')}
                name='address'
                rules={[{ required: true, message: '' }]}
                onClick={goToAddClientAddress}
              >
                <Input autoComplete='off' placeholder={t('address')} />
              </Form.Item>
            </Col>
          </>
        )}
        {cartData?.deliveries?.value === 0 && (
          <Col span={24}>
            <Form.Item
              name='delivery_point'
              label={t('delivery.point')}
              rules={[{ required: true, message: t('required') }]}
            >
              <DebounceSelect
                fetchOptions={fetchDeliveryPoints}
                placeholder={t('select.delivery.point')}
                onChange={(delivery_point) => {
                  dispatch(
                    setCartData({
                      delivery_point,
                      bag_id: currentBag,
                    }),
                  );
                }}
              />
            </Form.Item>
          </Col>
        )}
        <Col span={24}>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item
                name='delivery_date'
                label={t('delivery.date')}
                rules={[
                  {
                    required: true,
                    message: t('required'),
                  },
                ]}
                valuePropName={'date'}
              >
                <DatePicker
                  placeholder={t('delivery.date')}
                  className='w-100'
                  format='YYYY-MM-DD'
                  disabledDate={disabledDate}
                  onChange={(e) => {
                    const delivery_date = moment(e).format('YYYY-MM-DD');
                    dispatch(
                      setCartData({
                        delivery_date,
                        bag_id: currentBag,
                      }),
                    );
                  }}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label={`${t('delivery.time')} (${t('up.to')})`}
                name='delivery_time'
                rules={[
                  {
                    required: false,
                    message: t('required'),
                  },
                ]}
                valuePropName='date'
              >
                <DatePicker
                  disabled={!data.delivery_date}
                  picker='time'
                  placeholder={t('start.time')}
                  className='w-100'
                  format={'HH:mm:ss'}
                  showNow={false}
                  disabledTime={disabledDateTime}
                  onChange={(e) => {
                    const delivery_time = moment(e).format('HH:mm:ss');
                    dispatch(
                      setCartData({ delivery_time, bag_id: currentBag }),
                    );
                  }}
                />
              </Form.Item>
            </Col>
          </Row>
        </Col>
      </Row>
      {addressModal && (
        <PosUserAddress
          uuid={addressModal}
          handleCancel={() => setAddressModal(null)}
        />
      )}
    </Card>
  );
};

export default DeliveryInfo;
