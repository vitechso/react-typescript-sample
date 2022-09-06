import {
  addDoc,
  doc,
  DocumentData,
  getDocs,
  getFirestore,
  orderBy,
  QueryDocumentSnapshot,
  startAt,
} from '@firebase/firestore'
import {
  collection,
  deleteDoc,
  getDoc,
  limit,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore'
import {
  ImageModel,
  InfoModel,
  PaginatedProfileModels,
  ProfileImageModel,
  ProfileImageReceiverModel,
  SimilarProfileModels,
} from './../../../_metronic/helpers'
import {FirestoreManager} from '../system/FirestoreManager'
import {Utils} from '../system/Utils'
import {User, UserModel} from './User'
import {Chat} from '../chat/Chat'
import {limitToFirst, update} from 'firebase/database'
import { FirebaseApp } from '../FirebaseApp'

export class ProfileModel extends InfoModel {
  id: string = ''
  createdAt: string = ''
  controllerUuid: string = ''
  publicPhotos: ProfileImageModel[] = []
  privatePhotos: ProfileImageModel[] = []
  scrollImage: ProfileImageModel[] = []
  status: 'approved' | 'pending' | 'denied' = 'pending'
  sites: string[] = []

  constructor(params: any) {
    super(params)
    this.id = params.id
    this.createdAt = params.createdAt
    this.publicPhotos = params.publicPhotos
    this.privatePhotos = params.privatePhotos
    this.status = params.status
    this.sites = params.sites
    this.scrollImage = params.scrollImage
  }
}

export class Profile {
  public static async CreateNewProfile(
    params: any,
    publicPhotos: string[],
    privatePhotos: string[]
  ): Promise<void> {
    const firestore = getFirestore()
    params['createdAt'] = serverTimestamp()
    params['status'] = 'pending'
    let profilesRef = collection(firestore, 'profiles')

    await addDoc(profilesRef, params).then(async (ref) => {
      for (let i = 0; i < publicPhotos.length; i++) {
        let url = publicPhotos[i]
        await this.AddProfileImage(ref.id, url, 'public')
      }

      for (let i = 0; i < privatePhotos.length; i++) {
        let url = privatePhotos[i]
        await this.AddProfileImage(ref.id, url, 'private')
      }
    })

    Promise.resolve()
  }

  public static async GetProfilesByIds(profile_ids: string[]): Promise<ProfileModel[]> {
    let profileModels: ProfileModel[] = []
    for (let i = 0; i < profile_ids.length; i++) {
      await this.GetProfile(profile_ids[i]).then((model) => {
        if (model) profileModels.push(model)
      })
    }

    return Promise.resolve(profileModels)
  }

  public static async GetAllProfiles(
    age: number = -1,
    entry_limit: number = 100
  ): Promise<ProfileModel[]> {
    let profileModels: ProfileModel[] = []
    let site = Chat.SITE

    const firestore = getFirestore()
    let profilesRef = collection(firestore, 'profiles')
    let profilesQuery = query(
      profilesRef,
      limit(entry_limit),
      where('status', '==', 'approved'),
      where('sites', 'array-contains', site)
    )

    const querySnapshot = await getDocs(profilesQuery)
    querySnapshot.forEach((doc) => {
      let model = Utils.ParseDataToProfileModel(doc)
      if (age > 0) {
        if (model.age === age) {
          profileModels.push(model)
        }
      } else {
        profileModels.push(model)
      }
    })

    return Promise.resolve(profileModels)
  }

  public static async GetAllProfilesPaginated(
    lastVisible: QueryDocumentSnapshot<DocumentData> = null as any,
    currProfiles: ProfileModel[] = null as any,
    randomize: boolean = false,
    entry_limit: number = 25
  ): Promise<PaginatedProfileModels> {
    let paginatedProfileModels: PaginatedProfileModels = new PaginatedProfileModels()
    let profileModels: ProfileModel[] = currProfiles ? currProfiles : []
    let site = Chat.SITE


    const firestore = getFirestore()
    let profilesRef = collection(firestore, 'profiles')
    let profilesQuery = query(
      profilesRef,
      limit(entry_limit + 1),
      where('status', '==', 'approved'),
      where('sites', 'array-contains', site),
      orderBy('createdAt'),
      startAt(lastVisible)
    )

    const querySnapshot = await getDocs(profilesQuery)
    if (querySnapshot.docs.length === entry_limit + 1) {
      paginatedProfileModels.nextPageExists = true
      paginatedProfileModels.lastVisible = querySnapshot.docs[querySnapshot.docs.length - 1]
    }

    let newModels: ProfileModel[] = []
    for (let i = 0; i < querySnapshot.docs.length; i++) {
      if (i === entry_limit) continue

      let doc = querySnapshot.docs[i]
      // console.log(i)

      let model = Utils.ParseDataToProfileModel(doc)

      newModels.push(model)
    }

    if (randomize) newModels = newModels.sort(() => Math.random() - 0.5)

    for (let i = 0; i < newModels.length; i++) {
      profileModels.push(newModels[i])
    }

    if (lastVisible) paginatedProfileModels.append = true
    else paginatedProfileModels.append = false

    paginatedProfileModels.profiles = profileModels

    return Promise.resolve(paginatedProfileModels)
  }

  public static async GetSimilarProfiles(
    profileRef: ProfileModel,
    lastVisible: QueryDocumentSnapshot<DocumentData> = null as any
  ): Promise<any> {
    let similarProfileModel: any = new SimilarProfileModels()



    const firestore = getFirestore()
    const profilesRef = collection(firestore, 'profiles')
    const profilesQuery = query(
      profilesRef,
      where('bodyType', '==', profileRef.bodyType),
      where('sexualOrientation', '==', profileRef.sexualOrientation),
      where('ethnicity', '==', profileRef.ethnicity),
      where('country', '==', profileRef.country),
      orderBy('createdAt'),

      startAt(lastVisible)
    )



    let profiles: ProfileModel[] = []
    const snapshot = await getDocs(profilesQuery)
    if (snapshot.docs.length > 10) {
      similarProfileModel.lastVisible = snapshot.docs[5]
    }
    for (let i = 0; i <snapshot.docs.length; i++) {
      if (i === 5) break
      let doc = snapshot.docs[i]
      //this condition for not get similar profile
      if(doc.id != profileRef.id) {
        let model = Utils.ParseDataToProfileModel(doc)
        profiles.push(model)
      }
    }

    profiles = profiles.sort(() => Math.random() - 0.5)

    similarProfileModel.profiles = profiles

    return Promise.resolve(similarProfileModel)
  }



  public static async GetProfileFreeCredits(): Promise<ProfileModel> {
    const firestore = getFirestore()
    const profileDoc = doc(firestore, 'profiles', '40j0pABmZL7BL69Py0CT')
    const profileSnap = await getDoc(profileDoc)
    if (profileSnap.exists()) {
      let profileModel = Utils.ParseDataToProfileModel(profileSnap)
      return Promise.resolve(profileModel)
    } else {
      return Promise.resolve(null as any)
    }
  }

  public static async GetProfile(profileID: string): Promise<ProfileModel> {
    const firestore = getFirestore()
    const profileDoc = doc(firestore, 'profiles', profileID)
    const profileSnap = await getDoc(profileDoc)
    if (profileSnap.exists()) {
      let profileModel = Utils.ParseDataToProfileModel(profileSnap)
      return Promise.resolve(profileModel)
    } else {
      return Promise.resolve(null as any)
    }
  }

  public static async GetProfileNameOnly(profileID: string): Promise<string> {
    const firestore = getFirestore()
    const profileDoc = doc(firestore, 'profiles', profileID)
    const profileSnap = await getDoc(profileDoc)
    if (profileSnap.exists()) {
      let data = profileSnap.data()
      let profileName = data.displayName

      return Promise.resolve(profileName)
    } else {
      return Promise.resolve(null as any)
    }
  }

  /**
   * @deprecated The method should not be used
   */
  public static async GetProfileControlledBy(uuid: string): Promise<ProfileModel> {
    let profileModel: ProfileModel = null as any

    const firestore = getFirestore()
    let profilesRef = collection(firestore, 'profiles')
    let profilesQuery = query(profilesRef, where('controllerUuid', '==', uuid))

    const querySnapshot = await getDocs(profilesQuery)
    if (querySnapshot.size > 0) {
      let data = querySnapshot.docs[0].data()
      let model = new ProfileModel({
        id: data.id,
        displayName: data.displayName,
        photoURL: data.photoURL,
        controllerUuid: data.controllerUuid,
      })
      profileModel = model
    }
    return Promise.resolve(profileModel)
  }

  /**
   * @deprecated The method should not be used
   */
  public static async GetProfileController(profileID: string): Promise<UserModel> {
    let profile: ProfileModel = null as any
    await this.GetProfile(profileID)
      .then((result) => {
        profile = result
      })
      .catch((error) => {
        const errorCode = error.code
        const errorMessage = error.message
      })
    if (profile) {
      let controllerUuid: string = profile.controllerUuid
      if (controllerUuid && controllerUuid !== '') {
        let user: UserModel = null as any
        await User.GetUserAccount(controllerUuid).then((result) => {
          user = result
        })
        return Promise.resolve(user)
      } else {
        return Promise.resolve(null as any)
      }
    } else {
      let error: {} = {
        message: 'Profile not found.',
      }
      return Promise.reject(error)
    }
  }
  /**
   * @deprecated The method should not be used. Use AddProfileController/RemoveProfileController instead.
   */
  public static async SetProfileController(
    profileID: string,
    controllerUuid: string
  ): Promise<boolean> {
    const firestore = getFirestore()
    const profileRef = collection(firestore, 'profiles')
    const profileDoc = doc(profileRef, profileID)
    let params = {
      controllerUuid: controllerUuid,
    }
    params = this.CheckValidDataInput(params)
    let success: boolean = false
    await updateDoc(profileDoc, params).then(() => {
      success = true
    })
    return Promise.resolve(success)
  }

  public static async AddProfileController(
    profileID: string,
    controllerUuid: string
  ): Promise<boolean> {
    let success: boolean = false
    const firestore = getFirestore()
    const path = `profiles/${profileID}/controllers`
    const userDoc = doc(firestore, path, controllerUuid)
    const userSnap = await getDoc(userDoc)
    if (!userSnap.exists()) {
      const usersRef = collection(firestore, path)
      const usersDoc = doc(usersRef, controllerUuid)
      await setDoc(usersDoc, {
        uuid: controllerUuid,
      })
      success = true
    }
    return Promise.resolve(success)
  }

  public static async RemoveProfileController(
    profileID: string,
    controllerUuid: string
  ): Promise<boolean> {
    let success: boolean = false
    const firestore = getFirestore()
    const path = `profiles/${profileID}/controllers`
    const userDoc = doc(firestore, path, controllerUuid)
    const userSnap = await getDoc(userDoc)
    if (userSnap.exists()) {
      deleteDoc(userDoc)
      success = true
    }
    return Promise.resolve(success)
  }

  public static async GetProfileControllers(profileID: string): Promise<UserModel[]> {
    let controllers: UserModel[] = []
    let ids: string[] = []
    await this.GetProfileControllerIDs(profileID).then((result) => {
      ids = result
    })
    for (var idx in ids) {
      let user: UserModel = null as any
      let id = ids[idx]
      await User.GetUserAccount(id).then((result) => {
        user = result
      })
      if (user) {
        controllers.push(user)
      }
    }
    return Promise.resolve(controllers)
  }

  public static async GetProfileControllerIDs(profileID: string): Promise<string[]> {
    const firestore = getFirestore()
    let controllersRef = collection(firestore, `profiles/${profileID}/controllers`)
    let controllersQuery = query(controllersRef)

    const controllersSnap = await getDocs(controllersQuery)
    let ids: string[] = []
    controllersSnap.forEach((controller) => {
      ids.push(controller.id)
    })
    return Promise.resolve(ids)
  }

  public static async IsProfileControlledByUser(profileID: string, uuid: string): Promise<boolean> {
    let ids: string[] = []
    await this.GetProfileControllerIDs(profileID).then((result) => {
      ids = result
    })
    return Promise.resolve(ids.includes(uuid))
  }

  private static CheckValidDataInput(params: any): any {
    const allowedData: string[] = ['id', 'createdAt', 'displayName', 'photoURL', 'controllerUuid']
    let filteredData: any = {}
    allowedData.forEach((element) => {
      if (element in params) {
        filteredData[element] = params[element]
      }
    })

    return filteredData
  }

  public static async GetAllProfileIDs(status: string = 'approved'): Promise<string[]> {
    const firestore = getFirestore()
    let profilesRef = collection(firestore, 'profiles')
    let profilesQuery = query(profilesRef, where('status', '==', status))

    let ids: string[] = []
    const profilesSnap = await getDocs(profilesQuery)
    profilesSnap.forEach((profile) => {
      ids.push(profile.id)
    })
    return Promise.resolve(ids)
  }

  public static async ApproveProfile(profileId: string, approved: boolean) {
    const firestore = getFirestore()
    let profilesRef = collection(firestore, 'profiles')
    let profileDoc = doc(profilesRef, profileId)

    let params = {
      status: approved ? 'approved' : 'pending',
    }

    await updateDoc(profileDoc, params)
  }

  //#region Profile Pictures
  public static async AddProfileImage(profileId: string, url: string, imageType: string) {
    const firestore = getFirestore()
    let currTime = serverTimestamp()
    let imageData = {
      profile_id: profileId,
      photoURL: url,
      uploadedAt: currTime,
      imageType: imageType,
    }
    let imagesRef = collection(firestore, `profiles/${profileId}/images`)
    await addDoc(imagesRef, imageData)
  }

  public static async DeleteProfileImage(profileId: string, imageId: string) {
    let path = `profiles/${profileId}/images`
    const firestore = getFirestore()
    const imagesRef = collection(firestore, path)
    const imageDoc = doc(imagesRef, imageId)

    await deleteDoc(imageDoc)
  }

  public static async AddImageReceiver(
    profileId: string,
    imageId: string,
    receiverId: string,
    onReceiverAdded?: () => void | null | undefined
  ) {
    let path = `profiles/${profileId}/images/${imageId}/receivedBy`
    const firestore = getFirestore()
    const currTime = serverTimestamp()
    let receiverData = {
      receiver_id: receiverId,
      receivedAt: currTime,
    }

    const receiversRef = collection(firestore, path)
    await addDoc(receiversRef, receiverData).then((doc) => {
      if (onReceiverAdded) onReceiverAdded()
    })
  }

  public static async GetAllImageReceivers(
    profileId: string,
    imageId: string
  ): Promise<ProfileImageReceiverModel[]> {
    let path = `profiles/${profileId}/images/${imageId}/receivedBy`
    const firestore = getFirestore()
    const receiversRef = collection(firestore, path)
    const receiversQuery = query(receiversRef)

    let receivers: ProfileImageReceiverModel[] = []
    const receiversSnap = await getDocs(receiversQuery)
    receiversSnap.forEach((receiver) => {
      const data = receiver.data()
      if (data) {
        let receiverData: ProfileImageReceiverModel = {
          id: receiver.id,
          receiver_id: data.receiver_id,
          receivedAt: data.receivedAt,
        }
        receivers.push(receiverData)
      }
    })

    return Promise.resolve(receivers)
  }

  public static async GetAllProfileImages(
    profileId: string,
    imageType: string = null as any
  ): Promise<ProfileImageModel[]> {
    let path = `profiles/${profileId}/images`
    let path2 = `profiles/${profileId}`
    const firestore = getFirestore()
    const imagesRef = collection(firestore, path)

    const imagesQuery = imageType
      ? query(imagesRef, orderBy('uploadedAt'), where('imageType', '==', imageType))
      : query(imagesRef, orderBy('uploadedAt'))

    let images: ProfileImageModel[] = []
    const imagesSnap = await getDocs(imagesQuery)
    for (let i = 0; i < imagesSnap.size; i++) {
      let image = imagesSnap.docs[i]
      const data = image.data()
      if (data) {
        let receivers: ProfileImageReceiverModel[] = []
        await this.GetAllImageReceivers(profileId, image.id).then((data) => {
          if (data) receivers = data
        })

        let info: ImageModel = {
          id: image.id,
          ownerId: data.profile_id,
          photoURL: data.photoURL,
          uploadedAt: data.uploadedAt,
          reference: data.reference,
          type: data.imageType,
        }

        let imageData: ProfileImageModel = {
          info: info,
          receivedBy: receivers,
        }
        images.push(imageData)
      }
    }


    

    return Promise.resolve(images)
  }

  public static ListenForProfiles(
    age: number = -1,
    onUpdate: (profiles: ProfileModel[] | undefined) => void | null | Promise<void>
  ) {
    const firestore = getFirestore()
    let site = window.location.hostname

    let profilesRef = collection(firestore, 'profiles')
    let profilesQuery = query(
      profilesRef,
      where('status', '==', 'approved'),
      where('sites', 'array-contains', site)
    )

    let temp = 'approved'
    const key = `${temp}-profiles`
    FirestoreManager.AttachFirestoreListenerWithQuery(profilesQuery, key, async (snapshot) => {
      let profileModels: ProfileModel[] = []
      if (snapshot) {
        snapshot.forEach((doc) => {
          let model = Utils.ParseDataToProfileModel(doc)
          if (age > 0) {
            if (model.age === age) profileModels.push(model)
          } else {
            profileModels.push(model)
          }
        })
      }

      onUpdate(profileModels)
    })
  }

  public static StopListeningForProfiles(profileStatus: string = null as any) {
    let temp = profileStatus ? profileStatus : 'all'
    const key = `${temp}-profiles`
    FirestoreManager.DetachFirestoreListener(key)
  }

  public static ListenForProfileImages(
    profileId: string,
    onUpdate: (images: ProfileImageModel[] | undefined) => void | null | Promise<void>
  ) {
    let path = `profiles/${profileId}/images`
    const firestore = getFirestore()
    const imagesRef = collection(firestore, path)
    const imagesQuery = query(imagesRef, orderBy('uploadedAt'))

    const key = `${profileId}@images`
    FirestoreManager.AttachFirestoreListenerWithQuery(imagesQuery, key, async (snapshot) => {
      let images: ProfileImageModel[] = []
      if (snapshot) {
        for (let i = 0; i < snapshot.size; i++) {
          let image = snapshot.docs[i]
          const data = image.data()
          if (data) {
            let receivers: ProfileImageReceiverModel[] = []
            await this.GetAllImageReceivers(profileId, image.id).then((data) => {
              if (data) receivers = data
            })

            let info: ImageModel = {
              id: image.id,
              ownerId: data.profile_id,
              photoURL: data.photoURL,
              uploadedAt: data.uploadedAt,
              reference: data.reference,
              type: data.imageType,
            }

            let imageData: ProfileImageModel = {
              info: info,
              receivedBy: receivers,
            }

            images.push(imageData)
          }
        }
      }

      onUpdate(images)
    })
  }

  public static StopListeningForProfileImages(profileId: string) {
    const key = `${profileId}@images`
    FirestoreManager.DetachFirestoreListener(key)
  }

  public static ListenForProfileImageReceivers(
    profileId: string,
    imageId: string,
    onUpdate: (receivers: ProfileImageReceiverModel[] | undefined) => void | null
  ) {
    let path = `profiles/${profileId}/images/${imageId}/receivedBy`
    const firestore = getFirestore()
    const receiversRef = collection(firestore, path)
    const receiversQuery = query(receiversRef, orderBy(`receivedAt`))

    const key = `${profileId}-${imageId}@receivers`
    FirestoreManager.AttachFirestoreListenerWithQuery(receiversQuery, key, (snapshot) => {
      let receivers: ProfileImageReceiverModel[] = []
      if (snapshot) {
        snapshot.forEach((doc) => {
          if (doc) {
            const data = doc.data()
            if (data) {
              let receiverData = {
                id: doc.id,
                receiver_id: data.receiver_id,
                receivedAt: data.receivedAt,
              }
              receivers.push(receiverData)
            }
          }
        })
      }
      onUpdate(receivers)
    })
  }

  public static StopListeningForProfileImageReceivers(profileId: string, imageId: string) {
    const key = `${profileId}-${imageId}@receivers`
    FirestoreManager.DetachFirestoreListener(key)
  }
  //#endregion
}
