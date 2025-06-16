import React, { ButtonHTMLAttributes } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean
}

const CommonButton: React.FC<ButtonProps> = ({
  loading = false,
  children,
  disabled,
  ...rest
}) => {
  return (
    <button disabled={disabled || loading} {...rest}>
      {loading ? (
        <span className="flex items-center justify-center">
          <svg
            className="mr-2 h-5 w-5 animate-spin text-white"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            ></circle>
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            ></path>
          </svg>

        </span>
      ) : (
        children
      )}
    </button>
  )
}

export default CommonButton
