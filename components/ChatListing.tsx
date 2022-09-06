import React, { useEffect, useState } from 'react'
import { ProfileAndLatestMessageModel } from '../../_metronic/helpers';
import CircularProgress from '@mui/material/CircularProgress';
import moment from 'moment';
import { Link, useHistory, useLocation } from 'react-router-dom';
import { IconButton, List, ListItemButton } from '@mui/material';
import { isBrowser } from 'react-device-detect';
import { useSelector, shallowEqual } from 'react-redux';
import { RootState } from '../../setup';
import { User } from '../../client/client/user/User';

const ChatListing: React.FC<{ activeItem?: string }> = (activeItem) => {
   const history = useHistory();

   const [messages, setMessages] = useState<ProfileAndLatestMessageModel[]>();
   const chatMessages = useSelector((state:RootState) => state.chat.chatMessages, shallowEqual)
   const loader = useSelector((state:RootState) => state.chat.loader, shallowEqual)
   const unreadMsgs = useSelector((state:RootState) => state.chat.unreadMsgs, shallowEqual)

   const FORMAT = "M/DD/YYYY - hh:mm:ss a";

   const location = useLocation();

   const [isPage, setIsPage] = useState(false);

   const [messagingPanel, setMessagingPanel] = useState(false);

   useEffect(() => {
      if (location.pathname.startsWith("/user-profile/")) {
         setIsPage(true)
      }
   }, [location.pathname])

   useEffect(() => {
      if (location.pathname.startsWith("/messaging-panel")) {
         setMessagingPanel(true)
      }
   }, [location.pathname])

   const onMessageClicked = (profile_id: string) => {
      history.push(`/messaging-panel/${profile_id}`)
   }

   // useEffect(() => {
   //    Chat.ListenForLastReadMessages("chat-listing", (chatMessages) => {
   //       setLoading(false)
   //       setMessages(chatMessages);
   //       let unread = 0;
   //       chatMessages?.forEach((item) => {

   //          // item.message.timeFromNow = 
   //          if (item.read_status !== "read") {
   //             unread = unread + 1;
   //          }
   //       });
   //       setUnread(unread)
   //    })
   //    return () => {
   //       Chat.StopListeningForLastReadMessages("chat-listing")
   //    }
   // }, [])

   useEffect(()=>{
      setMessages(chatMessages);
   }, [chatMessages])

   return (
      <>
         <div className='left-overview'>
            <div className='sidechat-info'> 
               <div className='msg-head'>

                  {isBrowser && <h3>Messages {!loader && <span>{unreadMsgs} unread</span>}</h3>}

                  {!isBrowser && <h3 id="kt_drawer_example_basic_button"><i className="fas fa-comment-alt"></i><span className='CountCounter'>{unreadMsgs}</span></h3>}

                  <div className="sidechat-top-bnts">
                     {/* <IconButton color="error" className='search-btn'>
                        <i className="bi bi-search"></i>
                     </IconButton> */}

                     {/* <IconButton  onClick={()=>logout()} color="error" className='logout-btn'>
                        <i className="fas fa-sign-out-alt"></i>
                     </IconButton> */}

                     <Link to={`/landing-pub`}>
                        <IconButton color="error">
                           <i className="fas fa-home"></i>
                        </IconButton>
                     </Link>

                     {/* {!isPage && !messagingPanel && */}
                     <Link to={`/favorites`}>
                        <IconButton color="error" className="d-flex d-sm-none">
                           <i className="fa fa-heart"></i>
                        </IconButton>
                     </Link>
                     {/* } */}

                     <Link to={'javascript:void()'} data-bs-toggle="modal" data-bs-target="#kt_modal_1" className="d-block d-sm-none">
                        <IconButton color="error" className='dollar-icon'>
                           <i className="material-icons">monetization_on</i>
                        </IconButton>
                     </Link>

                     <Link to={`/my-profile`} className="d-block d-sm-none">
                        <IconButton color="error">
                           <i className="fa fa-user"></i>
                        </IconButton>
                     </Link>
                  </div>
               </div>

               {isBrowser && loader && <div className="spinnerLoder"><CircularProgress /></div>}

               {isBrowser &&
                  <div className='chat-nav-list custom-scroll'>
                     {messages?.map((item, index) => {
                        let msgText = item.message.contentType === 'text' ? item.message.text : "has sent an image";
                        return (
                           <List component="nav" key={index} className={(activeItem.activeItem === item.profile_id) ? 'chatprofile-grid active ' : 'chatprofile-grid'} onClick={() => { onMessageClicked(item.profile_id) }}>
                              {
                                 User.CheckEmailVerificationStatus() === true && item.profile_name === "Free Credits" ?
                                    <>
                                    </>
                                 :
                                    <ListItemButton className={item.read_status === 'unread' ? 'unreadMessage' : ''}>
                                       <div className='chatprofile-inner-details'>
                                          <div className='profile-img'>
                                             <img src={item.message.photoUrl} alt="" />
                                          </div>

                                          <div className='profile-details'>
                                             <h4>{item.profile_name}</h4>
                                             <p>{moment(item.message.time, FORMAT).fromNow()}</p>
                                             <div className='highlight-msg'><span className={item.message.type === 'in' ? 'dot-circle' : 'bi bi-arrow-90deg-left forword-arrow'}></span> <h6 dangerouslySetInnerHTML={{ __html: msgText }} className='highlight-text'></h6></div>
                                          </div>
                                       </div>
                                    </ListItemButton>
                              }
                           </List>
                        )  
                     })}

                  </div>
               }
            </div>
         </div>
      </>
   )
};

export default ChatListing;