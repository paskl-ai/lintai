interface ConfirmationDialogProps {
  title: string
  message: string
  confirmText: string
  cancelText?: string
  onConfirm: () => void
  onCancel: () => void
}

const ConfirmationDialog = ({
  title,
  message,
  confirmText,
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
}: ConfirmationDialogProps) => {
  return (
    <div className="bg-opacity-50 fixed inset-0 flex items-center justify-center bg-black">
      <div className="w-full max-w-sm rounded-lg bg-white p-6 text-center shadow-lg">
        <h2 className="text-lg font-bold">{title}</h2>
        <p className="mt-2 text-gray-600">{message}</p>

        <div className="mt-4 flex justify-between">
          <button
            onClick={onConfirm}
            className="rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700"
          >
            {confirmText}
          </button>
          <button onClick={onCancel} className="text-gray-700 hover:underline">
            {cancelText}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ConfirmationDialog
