import request from './request';

const chatService = {
    getUser: (id) => request.get(`dashboard/user/chat/users/${id}`)
};

export default chatService;
