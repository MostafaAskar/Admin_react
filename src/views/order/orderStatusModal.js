import React, { useEffect, useState } from 'react';
import { Button, Col, Form, Input, Modal, Row, Select } from 'antd';
import { shallowEqual, useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import orderService from 'services/order';
import { setRefetch } from 'redux/slices/menu';

export default function OrderStatusModal({ orderDetails: data, handleCancel }) {
  const { activeMenu } = useSelector((state) => state.menu, shallowEqual);
  const { statusList } = useSelector(
    (state) => state.orderStatus,
    shallowEqual,
  );

  const [form] = Form.useForm();
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [statuses, setStatuses] = useState(statusList);
  const selectedStatus = Form.useWatch('status', form);

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
        <Button
          key='save-form'
          type='primary'
          onClick={() => form.submit()}
          loading={loading}
        >
          {t('save')}
        </Button>,
        <Button key='cansel-modal' type='default' onClick={handleCancel}>
          {t('cancel')}
        </Button>,
      ]}
    >
      <Form
        form={form}
        layout='vertical'
        onFinish={onFinish}
        initialValues={{ status: data.status }}
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
              <Select>
                {statuses?.map((item) => (
                  <Select.Option key={item?.name} value={item?.name}>
                    {t(item?.name)}
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>
          </Col>
          {selectedStatus === 'canceled' && (
            <Col span={24}>
              <Form.Item
                label={t('canceled_note')}
                name='canceled_note'
                rules={[
                  {
                    required: true,
                    message: t('required'),
                  },
                ]}
              >
                <Input.TextArea />
              </Form.Item>
            </Col>
          )}
          {data.status !== 'pause' && selectedStatus === 'pause' && (
            <Col span={24}>
              <Form.Item label={t('pause_note')} name='pause_note'>
                <Input.TextArea />
              </Form.Item>
            </Col>
          )}
        </Row>
      </Form>
    </Modal>
  );
}
