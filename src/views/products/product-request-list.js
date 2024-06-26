import React, { useContext, useEffect, useState } from 'react';
import { Card, Image, Table, Button, Space, Tag, Modal } from 'antd';
import { useTranslation } from 'react-i18next';
import getImage from 'helpers/getImage';
import { EditOutlined, EyeOutlined, MessageOutlined } from '@ant-design/icons';
import { addMenu, disableRefetch, setMenuData } from 'redux/slices/menu';
import { shallowEqual, useDispatch, useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import CustomModal from 'components/modal';
import { Context } from 'context/context';
import { useNavigate } from 'react-router-dom';
import FilterColumns from 'components/filter-column';
import formatSortType from 'helpers/formatSortType';
import useDidUpdate from 'helpers/useDidUpdate';
import { fetchRequestModels } from 'redux/slices/request-models';
import { HiArrowNarrowRight } from 'react-icons/hi';
import requestAdminModelsService from 'services/request-models';
import moment from 'moment';
import ProductStatusModal from './productStatusModal';

const body = {
  type: 'product',
};

export default function ProductRequestList({ parentId, type = 'main' }) {
  const { t } = useTranslation();
  const { setIsModalVisible } = useContext(Context);
  const [loadingBtn, setLoadingBtn] = useState(false);
  const [isVisibleMsgModal, setIsVisibleMsgModal] = useState(false);
  const [modalText, setModalText] = useState('');
  const [id, setId] = useState(null);
  const [productDetails, setProductDetails] = useState(null);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { activeMenu } = useSelector((state) => state.menu, shallowEqual);
  const {
    data: requests,
    meta,
    loading,
    params,
  } = useSelector((state) => state.requestModels, shallowEqual);
  const data = activeMenu.data;

  const paramsData = {
    search: data?.search,
    sort: data?.sort,
    column: data?.column,
    perPage: data?.perPage,
    page: data?.page,
    parent_id: parentId,
    type: 'product',
  };

  const goToEdit = (row) => {
    dispatch(
      addMenu({
        url: `product-request/${row.id}`,
        id: 'product_request_edit',
        name: t('product.request.edit'),
      })
    );
    navigate(`/product-request/${row.id}`);
  };

  const goToShow = (row) => {
    dispatch(
      addMenu({
        url: `product-request-details/${row.id}`,
        id: 'product_request_details',
        name: t('product.request.details'),
      })
    );
    navigate(`/product-request-details/${row.id}`);
  };

  const [columns, setColumns] = useState([
    {
      title: t('created.by'),
      dataIndex: 'createdBy',
      key: 'createdBy',
      is_show: true,
      render: (createdBy) => (
        <span>
          {createdBy.firstname} {createdBy?.lastname}{' '}
          <a href={`tel:${createdBy?.phone}`}>{createdBy?.phone}</a>
        </span>
      ),
    },
    {
      title: t('created.at'),
      dataIndex: 'created_at',
      key: 'created_at',
      is_show: true,
      render: (createdAt) => moment(createdAt).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: t('name'),
      dataIndex: 'name',
      key: 'name',
      is_show: true,
      render: (_, row) => (
        <Space>
          {row.model.translation?.title} <HiArrowNarrowRight />{' '}
          {row.data[`title[${row.model.translation.locale}]`]}
        </Space>
      ),
    },
    {
      title: t('image'),
      dataIndex: 'img',
      key: 'img',
      is_show: true,
      render: (_, row) => {
        return (
          <Space>
            <Image
              src={getImage(row.model.img)}
              alt='img_gallery'
              width={100}
              className='rounded'
              preview
              placeholder
            />
            <HiArrowNarrowRight />
            <Image
              src={getImage(
                row.data.images?.at(0).url || row.data.images?.at(0)
              )}
              alt='img_gallery'
              width={100}
              className='rounded'
              preview
              placeholder
            />
          </Space>
        );
      },
    },
    {
      title: t('status'),
      is_show: true,
      dataIndex: 'status',
      key: 'status',
      render: (status, row) => (
        <div>
          {status === 'pending' ? (
            <Tag color='blue'>{t(status)}</Tag>
          ) : status === 'canceled' ? (
            <Tag color='error'>{t(status)}</Tag>
          ) : (
            <Tag color='cyan'>{t(status)}</Tag>
          )}
        </div>
      ),
    },
    {
      title: t('options'),
      key: 'options',
      dataIndex: 'options',
      is_show: true,
      render: (_, row) => {
        return (
          <Space>
            <Button icon={<EditOutlined />} onClick={() => goToEdit(row)} />
            {row?.status === 'cancelled' && row?.status_note && (
              <Button
                icon={<MessageOutlined />}
                onClick={() => {
                  setIsVisibleMsgModal(true);
                  setModalText(row.status_note);
                }}
              />
            )}
            <Button
              icon={<EyeOutlined />}
              onClick={(e) => {
                e.stopPropagation();
                goToShow(row);
              }}
            />
            <Button onClick={() => setProductDetails(row)}>
              {t('change.status')}
            </Button>
          </Space>
        );
      },
    },
  ]);

  useEffect(() => {
    dispatch(fetchRequestModels(paramsData));
    dispatch(disableRefetch(activeMenu));
  }, [activeMenu.refetch]);

  useDidUpdate(() => {
    dispatch(fetchRequestModels(paramsData));
  }, [activeMenu.data]);

  function onChangePagination(pagination, filter, sorter) {
    const { pageSize: perPage, current: page } = pagination;
    const { field: column, order } = sorter;
    const sort = formatSortType(order);
    dispatch(
      setMenuData({
        activeMenu,
        data: { ...activeMenu.data, perPage, page, column, sort },
      })
    );
  }

  const requestStatusChange = () => {
    setLoadingBtn(true);
    const params = {
      status: id?.at(0).status,
    };
    requestAdminModelsService
      .changeStatus(id?.at(0).id, params)
      .then(() => {
        toast.success(t('successfully.changed'));
        dispatch(fetchRequestModels(body));
        setIsModalVisible(false);
        setId(null);
      })
      .finally(() => setLoadingBtn(false));
  };

  const rowSelection = {
    selectedRowKeys: id,
    onChange: (key) => {
      setId(key);
    },
  };

  return (
    <Card
      title={t('requests')}
      extra={
        <Space wrap>
          <FilterColumns columns={columns} setColumns={setColumns} />
        </Space>
      }
    >
      <Table
        scroll={{ x: true }}
        rowSelection={rowSelection}
        columns={columns?.filter((item) => item.is_show)}
        dataSource={requests}
        pagination={{
          pageSize: params.perPage,
          page: activeMenu.data?.page || 1,
          total: meta.total,
          defaultCurrent: activeMenu.data?.page,
          current: activeMenu.data?.page,
        }}
        rowKey={(record) => record.key}
        onChange={onChangePagination}
        loading={loading}
      />
      {productDetails && (
        <ProductStatusModal
          orderDetails={productDetails}
          handleCancel={() => setProductDetails(null)}
          paramsData={paramsData}
          listType='request'
        />
      )}
      <CustomModal
        click={requestStatusChange}
        text={t('change.status')}
        setText={setId}
        loading={loadingBtn}
      />
      <Modal
        title='Reject message'
        closable={false}
        visible={isVisibleMsgModal}
        footer={null}
        centered
      >
        <p>{modalText}</p>
        <div className='d-flex justify-content-end'>
          <Button
            type='primary'
            className='mr-2'
            onClick={() => setIsVisibleMsgModal(false)}
          >
            {t('close')}
          </Button>
        </div>
      </Modal>
    </Card>
  );
}
