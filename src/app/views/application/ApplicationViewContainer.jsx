import React, { useContext, useEffect, useRef, useState } from "react";
import { useDocument } from 'react-firebase-hooks/firestore';
import { compose } from "recompose";
import { accessIfRole } from '../../../utils/siteAuth';
import SiteContext, { connectSiteContext } from "../../../utils/siteContext";
import { withPageWrapper } from "../../shared/PageWrapper/PageWrapperComponent";

import ApplicationViewComponent from './ApplicationViewComponent';


// Fetches a hacker's application from Firestore.
// Returns a firebase.firestore.DocumentReference of the current user's
// application entry in the /applications Firestore collection.
const fetchApplication = firebase =>
  () => firebase.firestore.collection('applications').doc(firebase.auth.currentUser && firebase.auth.currentUser.uid);


const createApplication = firebase =>
  () => firebase.firestore.collection('applications').doc(firebase.auth.currentUser && firebase.auth.currentUser.uid).set({ submitted: false });


// Updates a hacker's application with the new information they've provided.
const updateApplication = firebase => updatedAppInfo => {

  if(firebase.auth.currentUser && !updatedAppInfo.submitted)
    firebase.firestore.collection('applications').doc(firebase.auth.currentUser.uid)
      .update(updatedAppInfo);
}

// Submit a hacker's application. Non reversible.
const submitApplication = firebase => updatedAppInfo => {
  if(firebase.auth.currentUser)
    firebase.firestore.collection('applications').doc(firebase.auth.currentUser.uid)
      .update({ ...updatedAppInfo, submitted: true, submittedAt: firebase.getTimestamp(new Date()) })
}


const mapContextStateToProps = ({ state: { firebase } }) => ({
  fetchAppFirestore: fetchApplication(firebase),
  createAppFirestore: createApplication(firebase),
  updateAppFirestore: updateApplication(firebase),
  submitAppFirestore: submitApplication(firebase),
});

const enhance = compose(
  accessIfRole("HACKER"),
  withPageWrapper({ title: "My Application" }),
  connectSiteContext(mapContextStateToProps),
);



const ApplicationViewContainer = ({
  curUser,
  fetchAppFirestore,
  createAppFirestore,
  updateAppFirestore,
  submitAppFirestore,
}) => {

  const { dispatch } = useContext(SiteContext);
  const { value } = useDocument(fetchAppFirestore());
  const [ appState, updateAppState ] = useState("FETCHING");
  const [ localAppInfo, updateLocalAppInfo ] = useState({ submitted: false });
  const appRef = useRef();
  appRef.current = localAppInfo;

  const updateAppInfo = newAppInfo => {
    const newLocalAppInfo = {
      ...localAppInfo,
      ...newAppInfo,
    };

    updateLocalAppInfo(newLocalAppInfo);
    if(!newLocalAppInfo.submitted) dispatch({ type: "UPDATE_DASHBOARD_TOAST", data: { toastName: "appModified" } });
  }

  const submitAppInfo = () => {
    submitAppFirestore(appRef.current);
    updateAppState("SUBMITTING");
    dispatch({ type: "UPDATE_DASHBOARD_TOAST", data: { toastName: "appSubmitted" } });
  }

  if(value) {
    if(value.exists && ((appState === "FETCHING") || (value.data().submitted && appState === "SUBMITTING"))) {
      updateAppInfo(value.data());
      updateAppState("FETCHED");
      if(value.data().submitted) {
        updateAppState("SUBMITTED");
        dispatch({ type: "UPDATE_DASHBOARD_TOAST", data: { toastName: "appSubmitted" } });
      }
    } else if(!value.exists && (appState === "FETCHING")) {
      createAppFirestore();
      updateAppState("FETCHED");
    }
  }


  // save to firestore before component unmounts or page unloads
  useEffect(() => {
    window.addEventListener('beforeunload', () => updateAppFirestore(appRef.current));
    dispatch({ type: "UPDATE_TITLE", data: { title: "My Application" }});

    return () => {
      window.removeEventListener('beforeunload', () => updateAppFirestore(appRef.current))
      updateAppFirestore(appRef.current);
    }
  }, [])


  return (
      <ApplicationViewComponent curUserName={curUser && curUser.name} updateAppInfo={updateAppInfo} submitAppInfo={submitAppInfo} appState={appState} curAppInfo={localAppInfo} />
  );
};


export default enhance(ApplicationViewContainer);
