import request from './request';

const transactionService = {
  getAll: (params) =>
    request.get('dashboard/admin/transactions/paginate', { params }),
  getById: (id, params) =>
    request.get(`dashboard/admin/transactions/${id}`, { params }),
  create: (id, data) => request.post(`payments/order/${id}/transactions`, data),
  updateStatus: (id, params) =>
    request.put(`payments/order/${id}/transactions`, {}, { params }),
};

export default transactionService;
