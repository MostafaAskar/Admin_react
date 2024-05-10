import React, { useEffect, useState } from 'react';
import { Button, Col, Form, Modal, Row, Select, Input } from 'antd';
import { shallowEqual, useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import orderService from 'services/seller/order';
import { setRefetch } from 'redux/slices/menu';

const { TextArea } = Input;

export default function OrderStatusModal({ orderDetails: data, handleCancel }) {
  const { statusList } = useSelector(
    (state) => state.orderStatus,
    shallowEqual,
  );
  const { myShop } = useSelector((state) => state.myShop, shallowEqual);
  const { activeMenu } = useSelector((state) => state.menu, shallowEqual);
  const [form] = Form.useForm();
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [statuses, setStatuses] = useState([
    { id: 0, name: 'all', active: true, sort: 0 },
    ...statusList,
    { id: statusList?.length + 1, name: 'canceled', active: true, sort: 8 },
  ]);
  const [selectedStatus, setSelectedStatus] = useState(data?.status ?? '');

  useEffect(() => {
    const statusIndex = statusList.findIndex(
      (item) => item.name === data.status,
    );

    const newStatuses =
      statusIndex >= 0
        ? [
            statusList[statusIndex],
            statusIndex < statusList.length - 1
              ? statusList[statusIndex + 1]
              : null,
          ]
        : [
            statusIndex < statusList.length - 1
              ? statusList[statusIndex + 1]
              : null,
          ];
    if (statusList[statusIndex]?.name === 'on_a_way') {
      newStatuses.push(statusList[statusIndex + 3]);
    }
    newStatuses.push({ name: 'canceled', id: 8, active: true });

    setStatuses(newStatuses.filter(Boolean)); // Remove null values
  }, [data]);

  const onFinish = (values) => {
    setLoading(true);
    const params = { ...values };
    orderService
      .updateStatus(data.id, params)
      .then(() => {
        handleCancel();
        dispatch(setRefetch(activeMenu));
      })
      .finally(() => setLoading(false));
  };

  return (
    <Modal
      visible={!!data}
      title={data.title}
      onCancel={handleCancel}
      footer={[
        <Button type='primary' onClick={() => form.submit()} loading={loading}>
          {t('save')}
        </Button>,
        <Button type='default' onClick={handleCancel}>
          {t('cancel')}
        </Button>,
      ]}
    >
      <Form
        form={form}
        layout='vertical'
        onFinish={onFinish}
        initialValues={{ status: data?.status }}
      >
        <Row gutter={12}>
          <Col span={24}>
            <Form.Item
              label={t('status')}
              name='status'
              rules={[
                {
                  required: true,
                  message: t('required'),
                },
              ]}
            >
              <Select onChange={(e) => setSelectedStatus(e)}>
                {statuses?.map((item) => (
                  <Select.Option key={item?.id} value={item?.name}>
                    {t(item?.name)}
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>
            {selectedStatus === 'canceled' && (
              <Form.Item
                label={t('note')}
                name='note'
                rules={[
                  {
                    required: true,
                    message: t('required'),
                  },
                ]}
              >
                <TextArea rows={4} placeholder={t('note')} minLength={3} />
              </Form.Item>
            )}
            {data.status !== 'pause' && selectedStatus === 'pause' && (
              <Form.Item label={t('note')} name='note'>
                <TextArea rows={4} placeholder={t('note')} />
              </Form.Item>
            )}
          </Col>
        </Row>
      </Form>
    </Modal>
  );
}
