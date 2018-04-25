    /** Create New Message */
    @Tags('Message') @Security('jwt') @Post()
    public async createEntity(
        @Body() messageView: MessageView,
        @Request() req: express.Request,
    ): Promise<MessageEntity> {

        // 1. Luôn luôn phải check null trước khi dùng
        // Với method Post, Put => chú phải dùng try-catch vì nó rất dễ xảy ra lỗi, 
        //hoặc nhiều logic xử lý, hoặc qqery từ service khác => rất dễ có lỗi
        try {
            let userId = (<JwtToken>req.user).user;
            // Validation phải được thưc hiện ở cả client và server
            if (messageView && !messageView.content) {
                return Promise.reject('Can not send an empty message.');
            }

            let userInfo = await this.UserRepository.findOneById(userId);

            // Check null object từ server khác trước khi dùng
            if (!userInfo) {
                return Promise.reject(`Could not found sender id ${userId}`);
            }

            let userInfoSendNoti = await this.UserRepository.findOneById(messageView.toUserId);

            // Check null object từ server khác trước khi dùng
            if (!userInfoSendNoti) {
                return Promise.reject(`Could not found receiver id ${messageView.toUserId}`);
            }
            // => ở đây message cần ít nhất 3 field required: From user, to user, content. 
            // Đến dòng code này chú đã đảm bảo 3 fields này != null
            let message = await this.MessageRepository.save(<MessageEntity>{ userId: userId, toUserId: messageView.toUserId, content: messageView.content, delivered: messageView.delivered, announced: messageView.announced });
            // Check null object từ server khác trước khi dùng
            if (message) {
                let defaults = userInfoSendNoti.profiles && userInfoSendNoti.profiles.default ? userInfoSendNoti.profiles.default : null;
                // userInfoSendNoti.profiles && userInfoSendNoti.profiles.default 
                // phải check null userInfoSendNoti.profiles trước khi dùng property của nó
                
                if (defaults) {
                    let fcm = defaults.fcmToken ? defaults.fcmToken : "0";
                    if (fcm !== "0") {
                        var messageNoti = {
                            data: {
                                title: "Tin nhắn: " + userInfo.name,
                                message: messageView.content
                            },
                            token: fcm
                        };
                        // Cái này nếu support Promise thì chỉ cần await vì đã có try-catch bên ngoài
                        await firebaseAdmin.messaging().send(messageNoti);
                    }
                }
                return Promise.resolve(await this.MessageRepository.findOneById(message._id));
            }
        } catch (error) {
            //try-catch bên ngoài đảm bảo nếu có lỗi throw ra thì nó sẽ nhảy hết vào đây
            console.log(error);
            return Promise.reject(error);
        }
    }