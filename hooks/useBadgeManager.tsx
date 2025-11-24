import { useEffect, useRef, useState } from "react";
import {
  getFirestore,
  collection,
  onSnapshot,
  orderBy,
  query,
  doc,
  limit,
  getDoc,
} from "@react-native-firebase/firestore";
import { getAuth } from "@react-native-firebase/auth";
import { notificationService } from "../services/notificationService";

type SubChat = {
  id: string;
  members?: string[];
};

type Campaign = {
  id: string;
  applied?: string[];
  approved?: string[];
  rejected?: string[];
};

export const useBadgeManager = () => {
  const db = getFirestore();
  const auth = getAuth();
  const [unreadChatsCount, setUnreadChatsCount] = useState(0);
  const [lastRead, setLastRead] = useState<Record<string, any>>({});
  const latestRef = useRef<Record<string, any>>({});
  const unsubLatestRef = useRef<(() => void)[]>([]);
  const [subChats, setSubChats] = useState<SubChat[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const isInitialized = useRef(false);

  // Listen to user's lastRead timestamps
  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;

    const unsubUser = onSnapshot(doc(db, "users", uid), (snap) => {
      const data = snap.data() as any;
      setLastRead(data?.lastRead || {});
    });

    return () => unsubUser();
  }, []);

  // Listen to subchats and campaigns
  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;

    // First check if user is admin
    const checkUserAndListen = async () => {
      const userDocRef = doc(db, "users", uid);
      const userDocSnap = await getDoc(userDocRef);
      const userData = userDocSnap.data();
      const isAdmin = userData?.isAdmin || userData?.role === "admin";

      // Listen to subchats
      const unsubSub = onSnapshot(
        query(collection(db, "subChats"), orderBy("createdAt", "desc")),
        (snap) => {
          const items: SubChat[] = [];
          snap.forEach((docSnap) => {
            const data = docSnap.data() as any;
            // If admin, include all chats. Otherwise only where user is member
            if (isAdmin || (data.members && data.members.includes(uid))) {
              items.push({ id: docSnap.id, ...data });
            }
          });
          setSubChats(items);
        }
      );

      // Listen to campaigns
      const unsubCamp = onSnapshot(
        query(collection(db, "campaigns"), orderBy("createdAt", "desc")),
        (snap) => {
          const items: Campaign[] = [];
          snap.forEach((docSnap) => {
            const data = docSnap.data() as any;
            if (isAdmin) {
              // Admin sees all campaigns
              items.push({ id: docSnap.id, ...data });
            } else {
              // Regular users only see campaigns they're involved in
              const allMembers = [
                ...(data.applied || []),
                ...(data.approved || []),
                ...(data.rejected || []),
              ];
              if (allMembers.includes(uid)) {
                items.push({ id: docSnap.id, ...data });
              }
            }
          });
          setCampaigns(items);
        }
      );

      return () => {
        unsubSub();
        unsubCamp();
      };
    };

    const unsubPromise = checkUserAndListen();
    return () => {
      unsubPromise.then(unsub => unsub?.());
    };
  }, []);

  // Build latest message listeners for each chat
  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;

    // Cleanup previous listeners
    unsubLatestRef.current.forEach((u) => u());
    unsubLatestRef.current = [];
    latestRef.current = {};

    // Listen to general chat
    const unsubGeneral = onSnapshot(
      query(
        collection(db, "globalChat"),
        orderBy("createdAt", "desc"),
        limit(1)
      ),
      (qs) => {
        if (qs.empty) {
          latestRef.current["general"] = null;
        } else {
          latestRef.current["general"] =
            qs.docs[0].data().createdAt || qs.docs[0].data().timestamp;
        }
      }
    );
    unsubLatestRef.current.push(unsubGeneral);

    // Listen to subchats
    subChats.forEach((sc) => {
      const key = `subchat_${sc.id}`;
      const unsub = onSnapshot(
        query(
          collection(db, "subChats", sc.id, "messages"),
          orderBy("createdAt", "desc"),
          limit(1)
        ),
        (qs) => {
          if (qs.empty) {
            latestRef.current[key] = null;
          } else {
            latestRef.current[key] =
              qs.docs[0].data().createdAt || qs.docs[0].data().timestamp;
          }
        }
      );
      unsubLatestRef.current.push(unsub);
    });

    // Listen to campaigns
    campaigns.forEach((c) => {
      const key = `campaign_${c.id}`;
      const approved = new Set(c.approved || []);
      const unsub = onSnapshot(
        query(
          collection(db, "campaigns", c.id, "chat"),
          orderBy("createdAt", "desc"),
          limit(5)
        ),
        (qs) => {
          let latest: any = null;
          qs.forEach((d) => {
            const data = d.data() as any;
            // Only consider messages from approved users if applicable
            if (approved.size === 0 || approved.has(data.userId)) {
              if (!latest) latest = data.createdAt || data.timestamp;
            }
          });
          latestRef.current[key] = latest;
        }
      );
      unsubLatestRef.current.push(unsub);
    });

    return () => {
      unsubLatestRef.current.forEach((u) => u());
      unsubLatestRef.current = [];
    };
  }, [subChats, campaigns]);

  // Calculate unread chats count and update badge
  useEffect(() => {
    // Wait a bit for all listeners to be set up
    const timer = setTimeout(() => {
      let unreadCount = 0;

      // Check general chat
      const generalLatest = latestRef.current["general"];
      const generalLast = lastRead?.["general"];
      if (generalLatest && (!generalLast || 
        (generalLatest.seconds || generalLatest._seconds || 0) > 
        (generalLast.seconds || generalLast._seconds || 0))) {
        unreadCount++;
      }

      // Check subchats
      subChats.forEach((sc) => {
        const key = `subchat_${sc.id}`;
        const latest = latestRef.current[key];
        const last = lastRead?.[key];
        if (latest && (!last || 
          (latest.seconds || latest._seconds || 0) > 
          (last.seconds || last._seconds || 0))) {
          unreadCount++;
        }
      });

      // Check campaigns
      campaigns.forEach((c) => {
        const key = `campaign_${c.id}`;
        const latest = latestRef.current[key];
        const last = lastRead?.[key];
        if (latest && (!last || 
          (latest.seconds || latest._seconds || 0) > 
          (last.seconds || last._seconds || 0))) {
          unreadCount++;
        }
      });

      setUnreadChatsCount(unreadCount);

      // Update badge only after initial setup
      if (isInitialized.current) {
        notificationService.setBadgeCount(unreadCount);
      } else {
        // Mark as initialized after first calculation
        isInitialized.current = true;
        notificationService.setBadgeCount(unreadCount);
      }
    }, 500); // Small delay to ensure all listeners are set up

    return () => clearTimeout(timer);
  }, [lastRead, subChats, campaigns]);

  return {
    unreadChatsCount,
    updateBadge: (count: number) => notificationService.setBadgeCount(count),
    clearBadge: () => notificationService.clearBadge(),
  };
};