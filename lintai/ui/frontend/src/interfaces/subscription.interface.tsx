export interface ISubscriptionTable {
  items: ISubscription[]
  onSubscriptionSelect: (
    event: React.MouseEvent<HTMLButtonElement>,
    index: number,
  ) => void
}

export interface ISubscription {
  price: number
  reasons: string[]
}
