import React, { useState, useEffect } from 'react';
import { Button, Form, Modal } from 'antd';
import { shallowEqual, useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import Map from 'components/map';
import getDefaultLocation from 'helpers/getDefaultLocation';
import { setCartData } from 'redux/slices/cart';
import { getCartData } from 'redux/selectors/cartSelector';
import AddressForm from 'components/forms/address-form';

export default function PosUserAddress({ uuid, handleCancel }) {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const dispatch = useDispatch();
  const data = useSelector((state) => getCartData(state.cart));
  const { currentBag } = useSelector((state) => state.cart, shallowEqual);
  const { settings } = useSelector(
    (state) => state.globalSettings,
    shallowEqual,
  );
  const { defaultLang } = useSelector((state) => state.formLang, shallowEqual);

  const [location, setLocation] = useState(
    data.address
      ? { lat: data.address.lat, lng: data.address.lng }
      : getDefaultLocation(settings),
  );

  const [value, setValue] = useState(data?.address?.address);

  const onFinish = (values) => {
    const body = {
      address: values?.[`address[${defaultLang}]`],
      active: 1,
      lat: location.lat,
      lng: location.lng,
    };
    dispatch(
      setCartData({
        address: body,
        bag_id: currentBag,
      }),
    );
    handleCancel();
  };

  useEffect(() => {
    form.setFieldsValue({
      address: data.address.address || null,
    });
  }, [currentBag]);

  return (
    <Modal
      visible={!!uuid}
      title={t('create.address')}
      onCancel={handleCancel}
      footer={[
        <Button type='primary' key={'saveBtn'} onClick={() => form.submit()}>
          {t('save')}
        </Button>,
        <Button type='default' key={'cancelBtn'} onClick={handleCancel}>
          {t('cancel')}
        </Button>,
      ]}
    >
      <Form
        layout='vertical'
        name='user-address'
        form={form}
        onFinish={onFinish}
        initialValues={{ [`address[${defaultLang}]`]: data.address.address }}
      >
        <AddressForm
          value={value}
          setValue={setValue}
          setLocation={setLocation}
        />
        <Form.Item label={t('map')}>
          <Map
            location={location}
            setLocation={setLocation}
            setAddress={(value) =>
              form.setFieldsValue({ [`address[${defaultLang}]`]: value })
            }
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}
