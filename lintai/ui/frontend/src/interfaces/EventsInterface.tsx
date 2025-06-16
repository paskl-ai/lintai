import { DetailedHTMLProps, InputHTMLAttributes } from 'react'

export interface EventInterface {
  onDataChanged: (
    e: DetailedHTMLProps<
      InputHTMLAttributes<HTMLInputElement>,
      HTMLInputElement
    >,
  ) => void
}
