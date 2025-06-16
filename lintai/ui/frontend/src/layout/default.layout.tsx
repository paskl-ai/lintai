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
import PrivateHeader from '../components/header/private-header.component'

const DefaultLayout = () => {
  return (
    <>
          <PrivateHeader userInfo={{email:'Team@lint.ai'}} key={'1'} />
      <div className="p-4">
        <div className="mt-14">
          <Outlet />
        </div>
      </div>
    </>
  )
}

export default DefaultLayout
