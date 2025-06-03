import cx from 'clsx'
import type { ToastContentProps } from 'react-toastify'
import { Bounce, toast, ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'

type CustomNotificationProps = ToastContentProps<{
  title: string
  content: string
}>

export const ToastError = (content: string) => {
  toast(CustomNotification, {
    data: {
      content: content,
      title: 'Oh Snap!',
    },
  })
}

export function CustomNotification({
  closeToast,
  data,
  toastProps,
}: CustomNotificationProps) {
  const isColored = toastProps.theme === 'colored'

  return (
    <div className="flex w-full flex-col">
      <h3 className="text-sm font-semibold">{data.title}</h3>
      <div className="flex items-center justify-between">
        <p className="text-sm">{data.content}</p>
        <button
          onClick={closeToast}
          className={cx(
            'ml-auto rounded-md border px-4 py-2 text-xs text-white transition-all active:scale-[.95]',
            isColored ? 'bg-transparent' : 'bg-btn-act',
          )}
        >
          Try again
        </button>
      </div>
    </div>
  )
}
const ProvocativeToastContainer: React.FC = () => {
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
        // theme="colored"
        transition={Bounce}
      />
      <ToastContainer />
    </>
  )
}

export default ProvocativeToastContainer
