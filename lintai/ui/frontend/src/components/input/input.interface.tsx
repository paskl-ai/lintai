import type { IBaseInputFields } from '../../interfaces/BaseInputInterface'
import type { EventInterface } from '../../interfaces/EventsInterface'
import type { DetailedHTMLProps, InputHTMLAttributes } from 'react'

export interface ITextInput extends IBaseInputFields, EventInterface {
  showLabel?: boolean
  label?: string
  hasError?: boolean
  errorMessage?: string
  onDataChanged: (
    e: DetailedHTMLProps<
      InputHTMLAttributes<HTMLInputElement>,
      HTMLInputElement
    >,
  ) => void
}
