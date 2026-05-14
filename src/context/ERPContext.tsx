import { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import { onAuthStateChanged, sendPasswordResetEmail, signInWithEmailAndPassword, signOut, type User } from 'firebase/auth';
import type {
  ActivityLogRecord,
  EmployeeRecord,
  LocationLabelRecord,
  OrderPickingSession,
  PullConfirmationRecord,
  PutAwaySession,
  ReceivingLabelRecord,
  UserProfile,
} from '../types';
import { getFirebaseAuth, getFirebaseConfigError, isFirebaseConfigured } from '../lib/firebase';
import {
  COLLECTIONS,
  ensureUserProfile,
  mapActivityLogRecord,
  mapCycleCountSession,
  mapEmployeeRecord,
  mapLocationLabelRecord,
  mapOrderPickingSession,
  mapPullConfirmationRecord,
  mapPutAwaySession,
  mapReceivingLabelRecord,
  watchCollection,
  watchUserProfile,
} from '../lib/warehouse-store';
import type { CycleCountSession } from '../types';

interface ERPContextValue {
  firebaseReady: boolean;
  firebaseError: string;
  authLoading: boolean;
  dataLoading: boolean;
  currentUser: UserProfile | null;
  isLeadOrAdmin: boolean;
  employees: EmployeeRecord[];
  receivingLabels: ReceivingLabelRecord[];
  locations: LocationLabelRecord[];
  putAwayLogs: PutAwaySession[];
  cycleCountSessions: CycleCountSession[];
  orderPickingSessions: OrderPickingSession[];
  pullConfirmations: PullConfirmationRecord[];
  activityLogs: ActivityLogRecord[];
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
}

const ERPContext = createContext<ERPContextValue | null>(null);

function buildFallbackUser(user: User): UserProfile {
  return {
    uid: user.uid,
    name: user.displayName || user.email?.split('@')[0] || 'Warehouse User',
    email: user.email ?? '',
    role: 'picker',
    active: true,
  };
}

export function ERPProvider({ children }: PropsWithChildren) {
  const firebaseReady = isFirebaseConfigured();
  const firebaseError = getFirebaseConfigError();

  const [authLoading, setAuthLoading] = useState(firebaseReady);
  const [dataLoading, setDataLoading] = useState(false);
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [receivingLabels, setReceivingLabels] = useState<ReceivingLabelRecord[]>([]);
  const [locations, setLocations] = useState<LocationLabelRecord[]>([]);
  const [putAwayLogs, setPutAwayLogs] = useState<PutAwaySession[]>([]);
  const [cycleCountSessions, setCycleCountSessions] = useState<CycleCountSession[]>([]);
  const [orderPickingSessions, setOrderPickingSessions] = useState<OrderPickingSession[]>([]);
  const [pullConfirmations, setPullConfirmations] = useState<PullConfirmationRecord[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLogRecord[]>([]);

  useEffect(() => {
    if (!firebaseReady) {
      setAuthLoading(false);
      return;
    }

    const auth = getFirebaseAuth();

    return onAuthStateChanged(auth, async (user) => {
      setAuthUser(user);
      setAuthLoading(false);

      if (!user) {
        setUserProfile(null);
        setEmployees([]);
        setReceivingLabels([]);
        setLocations([]);
        setPutAwayLogs([]);
        setCycleCountSessions([]);
        setOrderPickingSessions([]);
        setPullConfirmations([]);
        setActivityLogs([]);
        return;
      }

      setUserProfile(buildFallbackUser(user));

      try {
        await ensureUserProfile(user);
      } catch (error) {
        console.error('Unable to ensure user profile:', error);
      }
    });
  }, [firebaseReady]);

  useEffect(() => {
    if (!firebaseReady || !authUser) {
      return;
    }

    return watchUserProfile(authUser.uid, (profile) => {
      if (profile) {
        setUserProfile(profile);
      }
    });
  }, [authUser, firebaseReady]);

  useEffect(() => {
    if (!firebaseReady || !authUser) {
      return;
    }

    setDataLoading(true);

    const unsubscribers = [
      watchCollection(COLLECTIONS.employees, mapEmployeeRecord, setEmployees, 250),
      watchCollection(COLLECTIONS.receivingLabels, mapReceivingLabelRecord, setReceivingLabels, 250),
      watchCollection(COLLECTIONS.locations, mapLocationLabelRecord, setLocations, 250),
      watchCollection(COLLECTIONS.putAwayLogs, mapPutAwaySession, setPutAwayLogs, 150),
      watchCollection(COLLECTIONS.cycleCountSessions, mapCycleCountSession, setCycleCountSessions, 150),
      watchCollection(COLLECTIONS.orderPickingSessions, mapOrderPickingSession, setOrderPickingSessions, 150),
      watchCollection(COLLECTIONS.pullConfirmations, mapPullConfirmationRecord, setPullConfirmations, 250),
      watchCollection(COLLECTIONS.activityLogs, mapActivityLogRecord, setActivityLogs, 300),
    ];

    setDataLoading(false);

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [authUser, firebaseReady]);

  const currentUser = useMemo(() => {
    if (!authUser) {
      return null;
    }

    return userProfile ?? buildFallbackUser(authUser);
  }, [authUser, userProfile]);

  const isLeadOrAdmin = Boolean(currentUser && ['lead', 'admin', 'platformOwner'].includes(currentUser.role));

  async function handleSignIn(email: string, password: string) {
    if (!firebaseReady) {
      throw new Error(firebaseError);
    }

    await signInWithEmailAndPassword(getFirebaseAuth(), email, password);
  }

  async function handleSignOut() {
    if (!firebaseReady) {
      return;
    }

    await signOut(getFirebaseAuth());
  }

  async function handleSendPasswordReset(email: string) {
    if (!firebaseReady) {
      throw new Error(firebaseError);
    }

    await sendPasswordResetEmail(getFirebaseAuth(), email);
  }

  const value: ERPContextValue = {
    firebaseReady,
    firebaseError,
    authLoading,
    dataLoading,
    currentUser,
    isLeadOrAdmin,
    employees,
    receivingLabels,
    locations,
    putAwayLogs,
    cycleCountSessions,
    orderPickingSessions,
    pullConfirmations,
    activityLogs,
    signIn: handleSignIn,
    signOut: handleSignOut,
    sendPasswordReset: handleSendPasswordReset,
  };

  return <ERPContext.Provider value={value}>{children}</ERPContext.Provider>;
}

export function useERP() {
  const context = useContext(ERPContext);

  if (!context) {
    throw new Error('useERP must be used inside ERPProvider.');
  }

  return context;
}
