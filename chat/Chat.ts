import { collection, DocumentData, query, serverTimestamp, addDoc, where, updateDoc, setDoc, getDoc, QuerySnapshot,QueryConstraint } from "@firebase/firestore";
import { doc, getDocs, getFirestore, limit, limitToLast, orderBy, Timestamp } from "firebase/firestore";
import { MessageModel, ProfileAndLatestMessageModel } from "./../../../_metronic/helpers";
import { FirestoreManager } from "../system/FirestoreManager";
import { User, UserTag, UserTypes } from "../user/User";
import { Profile } from "../user/Profile";
import { Analytics, AnalyticsId } from "../system/Analytics";
import { HttpsActionNames, HttpsHandler } from "../system/HttpsHandler";

export class Chat
{
    static CHAT_ROUTE = "/messaging-panel"

    static CHATTER_REQUEST_FEED = "chatter_requests";
    static ADMIN_FEED = "admin_feed";

    static ORIGIN = window.location.origin;
    static PROTOCOL = window.location.protocol;
    static SITE = window.location.hostname.split(".")[0];
    
    //static firestore = getFirestore();
    static Initialize()
    {
      //this.firestore = getFirestore();
    }

    static async SetUserSendLastMessage(roomId: string, active: boolean) {
      const firestore = getFirestore();
      const chatsRef = collection(firestore, `sites/${this.SITE}/rooms`);
      const chatDoc = doc(chatsRef, roomId);
      let params =
      {
        "user_send_last_message": active
      };
      let success: boolean = false;
      await updateDoc(chatDoc, params).then(() => {
        success = true;
      })
      return Promise.resolve(success);
    }

    static async GetRoomStatus(roomID: string): Promise<boolean> {
      const firestore = getFirestore();
      const roomDoc = doc(firestore, `sites/${this.SITE}/rooms`, roomID);
      const roomSnap = await getDoc(roomDoc);
      let is_room_locked: boolean = false;
      if (roomSnap.exists()) {
        let data = roomSnap.data();

        is_room_locked = data.is_room_locked;
      }

      return Promise.resolve(is_room_locked);
    }

    static async SetReadStatus(roomID: string, status: 'read' | 'unread'): Promise<void>
    {
      const firestore = getFirestore();
      const roomDoc = doc(firestore, `sites/${this.SITE}/rooms`, roomID);

      let params = {
        "read_status": status
      }
      const roomSnap = await getDoc(roomDoc);
      if (roomSnap.exists())
         updateDoc(roomDoc, params);
    }

    static async SupportChatter(userId:string | undefined, profileId:string | undefined, userName:string | undefined, profileName:string | undefined, photoUrl:string | undefined, site:string | undefined, message: string | undefined) : Promise<void>{
      let url = `${HttpsHandler.BASE_URL}/${HttpsActionNames.SUPPORT_CHATTERS}`;
      let roomId:string = "";
      let messageData = {
         text:message,
         uuid: userId,
         photoURL: photoUrl,
         isChatter: false,
         recepient_id: profileId,
         contentType: `text`,
         createdAt: serverTimestamp(),
       }
      if(userId && profileId){
       roomId = Chat.GetPrivateChatRoomId(userId,profileId);
      }
      let params = {
         uuid:userId,
         username: userName,
         profileId,
         profileName,
         profilePicture: photoUrl,
         site,
         message
       }
       await HttpsHandler.SendPostRequest(
         url,
         params,
         true,
         async(success, data, message) => {
            let feedEntryData = {
               message: messageData
            }
           await Chat.SendToAdminFeed(roomId,feedEntryData, UserTag.SUPPORT);
           await Chat.SendToChatterRequestsFeed(roomId, feedEntryData, UserTag.SUPPORT);
           Promise.resolve();
           },
         (success, message) => {
           Promise.reject();
         }
       ) 
    }

    static async SendMessage(roomID:string, params:any, messageType: "message" | "profile_like" = "message"): Promise<void>
    {
      const firestore = getFirestore();
      let timeStamp = serverTimestamp();
      params.createdAt = timeStamp;
      let messagesRef = collection(firestore, `sites/${this.SITE}/rooms/${roomID}/messages`);
      //params = this.CheckValidDataInput(params);
      let recepient_id = params["recepient_id"];
      let user_id = params["uuid"]
      let content_type = params["contentType"];
      
      await addDoc(messagesRef, params).then(async (docRef) => {
        if (docRef) {
          let payload: Map<string, any> = new Map<string, any>();
          payload.set("recepient_id", recepient_id);
          payload.set("message_type", messageType);
          payload.set("content_type", content_type);
          payload.set("is_chatter", false);
          payload.set("profile_id", "null");
          Analytics.SendAnalyticsEvent(AnalyticsId.SEND_CHAT_MESSAGE, payload);

          const logsRef = collection(firestore, `sites/${this.SITE}/logs`)
          await addDoc(logsRef, params);

          const chatsRef = collection(firestore, `sites/${this.SITE}/rooms/`);
          const chatDoc = doc(chatsRef, roomID);
          let params2 =
          {
            "last_updated": timeStamp,
            "profile_id": recepient_id,
            "user_id": user_id,
            "read_status" : "read"
          };
          await setDoc(chatDoc, params2);
        }
      });
    }

    static async UpdateChatterFeedOnlineStatus(online: boolean): Promise<void>
    {
      const firestore = getFirestore();
      let messagesRef = collection(firestore, `chatter/${this.CHATTER_REQUEST_FEED}/feed`);
      let roomId = `${User.Model?.uuid}-online_status`;
      let existQuery = query(messagesRef, where("roomId", "==", roomId), where("userId", "==", User.Model?.uuid));
      let tag = online ? UserTag.LOGGED_IN : UserTag.LOGGED_OUT;

      let params = {

      };
      
      const existSnap = await getDocs(existQuery);
      if (existSnap.size > 0) {
        if (existSnap.docs[0]) {
          if (tag !== existSnap.docs[0].data().tag)
          {
            await this.SendToChatterRequestsFeed(roomId, params, tag);
          }
        }
      } else {
        await this.SendToChatterRequestsFeed(roomId, params, tag);
      }
    }

    static async UpdateAdminFeedOnlineStatus(online: boolean): Promise<void>
    {
      const firestore = getFirestore();
      let messagesRef = collection(firestore, `admin/${this.ADMIN_FEED}/feed`);
      let roomId = `${User.Model?.uuid}-online_status`;
      let existQuery = query(messagesRef, where("roomId", "==", roomId));
      let tag = online ? UserTag.LOGGED_IN : UserTag.LOGGED_OUT;

      let params = {

      };

      const existSnap = await getDocs(existQuery);
      if (existSnap.size > 0) {
        if (existSnap.docs[0]) {
          if (tag !== existSnap.docs[0].data().tag) {
            await this.SendToAdminFeed(roomId, params, tag);
          }
        }
      } else {
        await this.SendToAdminFeed(roomId, params, tag);
      }
    }

    static async SendGetCreditsFeedEntry(): Promise<void>
    {
      let roomId = `${User.Model?.uuid}-get_credits`;
      let params = {

      };

      // console.log("Sent Get Credits Feed Entries");
      await this.SendToChatterRequestsFeed(roomId, params, UserTag.CLICKED_GET_CREDITS, true);
      await this.SendToAdminFeed(roomId, params, UserTag.CLICKED_GET_CREDITS, true);
      return Promise.resolve();
    }

    static async SendToChatterRequestsFeed(roomId: string, params: any, tag: string = "New Message", byPassExists: boolean = false): Promise<void> {
      const firestore = getFirestore();  
      params.siteOfOrigin = this.SITE;
      params.tag = tag;
      params.roomId = roomId;
      params.userId = User.Model?.uuid
      params.isTestEntry = User.Model?.isTestAccount;
      
      let messagesRef = collection(firestore, `chatter/${this.CHATTER_REQUEST_FEED}/feed`);
      if (!byPassExists) 
      {
        //params = this.CheckValidDataInput(params);
        let existQuery = query(messagesRef, where("roomId", "==", roomId));

        const existSnap = await getDocs(existQuery);
        if (existSnap.size > 0) {
          if (existSnap.docs[0]) {
            let id = existSnap.docs[0].id;
            let messagesDoc = doc(messagesRef, id);

            await updateDoc(messagesDoc, params);
          }
        } else {
          params.createdAt = serverTimestamp();
          await addDoc(messagesRef, params)
        }
      } else {
        params.createdAt = serverTimestamp();
        await addDoc(messagesRef, params)
      }
    }

    //#region For Admin
    static async SendToAdminFeed(roomId: string, params: any, tag: string = "New Message", byPassExists: boolean = false) : Promise<void>
    {
      const firestore = getFirestore();
      params.siteOfOrigin = this.SITE;
      params.tag = tag;
      params.roomId = roomId;
      params.userId = User.Model?.uuid
      params.isTestEntry = User.Model?.isTestAccount;


      let messagesRef = collection(firestore, `admin/${this.ADMIN_FEED}/feed`);
      if (!byPassExists)
      {
        //params = this.CheckValidDataInput(params);
        let existQuery = query(messagesRef, where("roomId", "==", roomId), where("userId", "==", User.Model?.uuid));

        const existSnap = await getDocs(existQuery);
        if (existSnap.size > 0)
        {
          if (existSnap.docs[0])
          {
            let id = existSnap.docs[0].id;
            let messagesDoc = doc(messagesRef, id);
            
            await updateDoc(messagesDoc, params);
          }
        } else {
          params.createdAt = serverTimestamp();
          await addDoc(messagesRef, params)
        }
      } else {
        params.createdAt = serverTimestamp();
        await addDoc(messagesRef, params)
      }
    }
    //#endregion

    //#region Helpers
    private static CheckValidDataInput(params:any):any
    {
      const allowedData:string[] = 
      [
        "uuid",
        "createdAt",
        "photoURL",
        "text",
        "recepient_id",
        "isChatter",
        "contentType",
        "roomId",
        "siteOfOrigin"
      ]
      let filteredData:any = {};
      allowedData.forEach(element => {
        if(element in params)
        {
          filteredData[element] = params[element];
        }
      });
  
      return filteredData;
    }

    static GetPrivateChatRoomId(uuid_1: string, uuid_2 : string) : string
    {
      let roomId = "";
      let uuidArray = [uuid_1, uuid_2];
      uuidArray = uuidArray.sort();

      roomId = uuidArray[0] + "-" + uuidArray[1];

      return roomId;
    }

    public static async GetLatestMessage(roomID: string): Promise<MessageModel> {
      const firestore = getFirestore();
      const messagesRef = collection(firestore, `sites/${this.SITE}/rooms/${roomID}/messages`);
      const messagesQuery = query(messagesRef, orderBy('createdAt'), limitToLast(1));

      const messageSnap = await getDocs(messagesQuery);

      let message: MessageModel = null as any;
      let docs: DocumentData[] = [];
      let messages: MessageModel[] = [];

      if (!messageSnap.empty) {
        docs.push(messageSnap.docs[0].data());
      }

      messages = Chat.ExtractMessageQuery(docs, messageSnap);
      message = messages[0];
      return Promise.resolve(message);
    }

    static ExtractMessageQuery(messages: DocumentData[] | undefined, snapshot: QuerySnapshot<DocumentData>): Array<MessageModel> {
      const new_message_format: Array<MessageModel> = new Array<MessageModel>();
    
      if (messages) {
        for (let i = 0; i < messages?.length; i++) {
          var timestamp = messages[i].createdAt !== null ? messages[i].createdAt.toDate() : undefined;
          const timeDisplay = timestamp !== undefined ? timestamp.toLocaleDateString() + " - " + timestamp.toLocaleTimeString() : "Loading...";
          let messageType: 'in' | 'out' = 'out'
          if (User.Model)
          {
            if (User.Model?.userType === UserTypes.TYPE_CHATTER)
            {
              if (User.Model.profile && User.Model.profile.id === messages[i].uuid)
                messageType = 'out';
              else
                messageType = 'in';
            } else 
            {
              if (messages[i].uuid === User.Model.uuid)
              
                messageType = 'out';
              else
                messageType = 'in';
            }
          } else 
          {
            messageType = 'in'
          }
          
          let msgText: string = messages[i].text as string;
          msgText = msgText.replaceAll("\\n", "\n");

          const msg: MessageModel = {
            id: snapshot.docs[i].id,
            user: messages[i].uuid,
            type: messageType,
            text: msgText,
            time: timeDisplay,
            photoUrl: messages[i].photoURL,
            recepient_id: messages[i].recepient_id,
            isChatter: messages[i].isChatter,
            contentType: messages[i].contentType ? messages[i].contentType : 'text'
          }
          new_message_format.push(msg);
        }
      }
    
      return new_message_format;
    }
    //#endregion

    //#region Chat Listeners
    static ListenForChatRoomUserSendLastMessage(roomID: string, onUpdate: (user_send_last_message: boolean) => void | null) {
      const key = `${roomID}@user-send-last-message`;
      FirestoreManager.AttachFirestoreListener(`sites/${this.SITE}/rooms`, roomID, key, (doc) => {
        let userSendLastMessage: boolean = false;
        if (doc) {
          const data = doc.data();
          if (data) {
              userSendLastMessage = data.user_send_last_message as boolean;
          }
        }
        onUpdate(userSendLastMessage);
      })
    }

    static StopListeningForChatRoomUserSendLastMessage(roomID: string) {
      const key = `${roomID}@user-send-last-message`;
      FirestoreManager.DetachFirestoreListener(key);
    }

    static ListenForChatRoomMessages(roomID: string, entry_limit:number = 25, onUpdate: (messages: MessageModel[] | undefined) => void | null)
    {
      const firestore = getFirestore();
      const messagesRef = collection(firestore, `sites/${this.SITE}/rooms/${roomID}/messages`);
      const messagesQuery = query(messagesRef, orderBy('createdAt', 'asc'), limitToLast(entry_limit));
      const key = `${roomID}@messages`;
      FirestoreManager.AttachFirestoreListenerWithQuery(messagesQuery, key, (snapshot) => {
        let messages: MessageModel[] = [];
        if (snapshot)
        {
          let docData: DocumentData[] = [];
          snapshot.forEach((doc) => {
            if (doc)
            {
              const data = doc.data();
              if (data)
                docData.push(data);
            }
          })

          if (docData)
          {
            const temp = Chat.ExtractMessageQuery(docData, snapshot);
            if (temp)
              messages = temp;
          }
        }

        onUpdate(messages);
      });
    }

    static StopListeningForChatRoomMessages(roomID: string)
    {
      const key = `${roomID}@messages`;
      FirestoreManager.DetachFirestoreListener(key);
    }

    static ListenForLastReadMessages(keyPrefix: string, onUpdate: (messages: ProfileAndLatestMessageModel[] | undefined) => void | null) {
      const firestore = getFirestore();
      const messagesRef = collection(firestore, `sites/${this.SITE}/rooms`);
      const messagesQuery = query(messagesRef, orderBy('last_updated', 'desc'), where("user_id", "==", User.Model?.uuid), limit(15));
      const key = `${User.Model?.uuid}@${keyPrefix}-last-read-messages`;
      FirestoreManager.AttachFirestoreListenerWithQuery(messagesQuery, key, async (snapshot) => {
        let messages: ProfileAndLatestMessageModel[] = [];
        if (snapshot) {
          for (let i = 0; i < snapshot.size; i++) {
            let doc = snapshot.docs[i];
            const data = doc.data();
            if (data) {
              if (!doc.id.includes(User.Model?.uuid))
                continue;

              let id: string = data.profile_id;
              await this.GetLatestMessage(doc.id).then( async (msg) => {
                await Profile.GetProfile(id).then((profile) => {
                  let model: ProfileAndLatestMessageModel = {
                    profile_id: id,
                    message: msg,
                    read_status: data.read_status,
                    profile_name: profile.displayName
                  }

                  model.message.photoUrl = profile.photoURL
                  messages.push(model);
                })
              })
            }
          }
        }

        onUpdate(messages);
      });
    }

    static StopListeningForLastReadMessages(keyPrefix: string) {
      const key = `${User.Model?.uuid}@${keyPrefix}-last-read-messages`;
      FirestoreManager.DetachFirestoreListener(key);
    }

    static async GetLastTwoHourLogs(
      userId?: string,
      startDate: Date = new Date(),
      endDate: Date =  new Date(),
    ): Promise<MessageModel[]> {
      const firestore = getFirestore();
      const logsRef = collection(firestore, `sites/${this.SITE}/logs`);
  
      const queries: QueryConstraint[] = [];
      queries.push(orderBy("createdAt", "desc"));
  
      if (userId) queries.push(where("uuid", "==", userId));
  
      queries.push(where("createdAt", ">=", Timestamp.fromDate(startDate)));
      queries.push(where("createdAt", "<=", Timestamp.fromDate(endDate)));
      const logsQuery = query(logsRef, ...queries);
      const logsSnap = await getDocs(logsQuery);
  
      let messages: MessageModel[] = [];
      let docData: DocumentData[] = [];

      logsSnap.forEach((doc) => {
        if (doc) {
         (doc.data().text && doc.data().text.endsWith('liked your profile ❤') ) && docData.push(doc.data());
        }
      });
      const temp = Chat.ExtractMessageQuery(docData, logsSnap);
      messages = temp;
      return Promise.resolve(messages);
    }
    //#endregion
}