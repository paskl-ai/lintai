import { ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
const GlimpseToastContainer: React.FC = () => {
  return (
    <>
      <ToastContainer
        position="top-right"
        autoClose={5000}
        hideProgressBar={false}
        newestOnTop={true}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="light"
        progressClassName={''}
      />
      <ToastContainer />
    </>
  )
}

export default GlimpseToastContainer
