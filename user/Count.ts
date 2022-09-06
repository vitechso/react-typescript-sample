import { getFirestore, increment, updateDoc } from "@firebase/firestore";
import { collection, doc, getDoc } from "firebase/firestore";

export class Count 
{
    public static async GetCount(countType: string): Promise<number>
    {
        const firestore = getFirestore();
        let countRef = collection(firestore, "count");
        let countDoc = doc(countRef, countType);

        let count = 0;
        let countSnap = await getDoc(countDoc);
        if (countSnap.exists())
        {
            count = countSnap.data().count;
        }

        return Promise.resolve(count);
    }

    public static async IncrementCount(countType: string, num: number = 1): Promise<void>
    {
        const firestore = getFirestore();
        let countRef = collection(firestore, "count");
        let countDoc = doc(countRef, countType)

        let params = {
            count: increment(num)
        }

        let success = false;
        await updateDoc(countDoc, params).then(() => {
            success = false;
        });

        if (success)
            return Promise.resolve();
        else
            return Promise.reject();
    }

    public static async DecrementCount(countType: string, num: number = 1): Promise<void>
    {
        const firestore = getFirestore();
        let countRef = collection(firestore, "count");
        let countDoc = doc(countRef, countType);

        let params = {
            count: increment(num * -1)
        }

        let success = false;
        await updateDoc(countDoc, params).then(() => {
            success = true;
        })

        if (success)
            return Promise.resolve();
        else
            return Promise.reject();
    }
}

export class CountTypes
{
    public static get USER(): string { return "user_count"; }
    public static get CHATTER(): string { return "chatter_count"; }
    public static get PROFILE_CREATOR(): string { return "profile_creator_count"; }
    public static get PROFILE(): string { return "profile_count"; }
}