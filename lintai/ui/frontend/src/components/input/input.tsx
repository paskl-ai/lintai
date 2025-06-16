import type { DetailedHTMLProps, InputHTMLAttributes } from 'react'
import React from 'react'

import type { ITextInput } from './input.interface'

function GlimpseInput({
  title,
  type,
  label,
  showLabel,
  hasError,
  errorMessage,
  onDataChanged,
}: ITextInput & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <>
      {showLabel ? (
        <label
          htmlFor={title}
          className="block text-sm leading-6 font-medium text-gray-900"
        >
          {label}
        </label>
      ) : null}
      <input
        title={title}
        className={`mt-1 block h-10 w-full rounded-xl border-0 py-1.5 text-gray-900 ${
          hasError ? 'ring-red-600' : 'ring-gray-300'
        } shadow-sm ring-1 ring-inset placeholder:text-gray-400 focus:ring-2 focus:ring-inset ${
          hasError ? 'focus:ring-red-600' : 'focus:ring-gray-300'
        } sm:text-sm sm:leading-6`}
        type={type}
        onChange={(
          e: DetailedHTMLProps<
            InputHTMLAttributes<HTMLInputElement>,
            HTMLInputElement
          >,
        ) => {
          if (onDataChanged) {
            onDataChanged(e)
          }
        }}
      ></input>
      {hasError ? (
        <label className="bg-danger mt-1 flex w-full items-center gap-2 rounded-md p-1">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
          >
            <path
              d="M8 8.66659C8.18889 8.66659 8.34734 8.60259 8.47534 8.47459C8.60289 8.34703 8.66667 8.18881 8.66667 7.99992V5.31659C8.66667 5.1277 8.60289 4.97214 8.47534 4.84992C8.34734 4.7277 8.18889 4.66659 8 4.66659C7.81111 4.66659 7.65289 4.73036 7.52534 4.85792C7.39734 4.98592 7.33334 5.14436 7.33334 5.33325V8.01659C7.33334 8.20547 7.39734 8.36103 7.52534 8.48325C7.65289 8.60547 7.81111 8.66659 8 8.66659ZM8 11.3333C8.18889 11.3333 8.34734 11.2693 8.47534 11.1413C8.60289 11.0137 8.66667 10.8555 8.66667 10.6666C8.66667 10.4777 8.60289 10.3193 8.47534 10.1913C8.34734 10.0637 8.18889 9.99992 8 9.99992C7.81111 9.99992 7.65289 10.0637 7.52534 10.1913C7.39734 10.3193 7.33334 10.4777 7.33334 10.6666C7.33334 10.8555 7.39734 11.0137 7.52534 11.1413C7.65289 11.2693 7.81111 11.3333 8 11.3333ZM8 14.6666C7.07778 14.6666 6.21111 14.4915 5.4 14.1413C4.58889 13.7915 3.88334 13.3166 3.28334 12.7166C2.68334 12.1166 2.20845 11.411 1.85867 10.5999C1.50845 9.78881 1.33334 8.92214 1.33334 7.99992C1.33334 7.0777 1.50845 6.21103 1.85867 5.39992C2.20845 4.58881 2.68334 3.88325 3.28334 3.28325C3.88334 2.68325 4.58889 2.20814 5.4 1.85792C6.21111 1.50814 7.07778 1.33325 8 1.33325C8.92222 1.33325 9.78889 1.50814 10.6 1.85792C11.4111 2.20814 12.1167 2.68325 12.7167 3.28325C13.3167 3.88325 13.7916 4.58881 14.1413 5.39992C14.4916 6.21103 14.6667 7.0777 14.6667 7.99992C14.6667 8.92214 14.4916 9.78881 14.1413 10.5999C13.7916 11.411 13.3167 12.1166 12.7167 12.7166C12.1167 13.3166 11.4111 13.7915 10.6 14.1413C9.78889 14.4915 8.92222 14.6666 8 14.6666ZM8 13.3333C9.47778 13.3333 10.7362 12.8139 11.7753 11.7753C12.814 10.7361 13.3333 9.4777 13.3333 7.99992C13.3333 6.52214 12.814 5.2637 11.7753 4.22459C10.7362 3.18592 9.47778 2.66659 8 2.66659C6.52222 2.66659 5.264 3.18592 4.22534 4.22459C3.18622 5.2637 2.66667 6.52214 2.66667 7.99992C2.66667 9.4777 3.18622 10.7361 4.22534 11.7753C5.264 12.8139 6.52222 13.3333 8 13.3333Z"
              fill="#D31510"
            />
          </svg>
          {errorMessage}
        </label>
      ) : null}
    </>
  )
}

export default GlimpseInput
