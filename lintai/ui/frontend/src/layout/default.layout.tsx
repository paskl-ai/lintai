// import { Outlet } from "react-router-dom";
// import { useSelector } from "react-redux";
// import { Navigate } from "react-router-dom";
// import { RootState } from "../store/glimpse-store";

// const DefaultLayout = () => {
//   const { loggedInUser } = useSelector((state: RootState) => state.auth);
//   console.log("Default ", loggedInUser);
//   if (loggedInUser) {
//     return <Navigate replace to={"/dashboard"} />;
//   }

//   return (
//     <>
//       <Outlet />
//     </>
//   );
// };

// export default DefaultLayout;

import { Outlet } from 'react-router'
import PublicHeader from '../components/header/public-header.component'

const DefaultLayout = () => {
  return (
    <>
      <PublicHeader />
      <Outlet />
    </>
  )
}

export default DefaultLayout
