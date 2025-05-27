export interface ITab {
  items: ITabItem[]
  onClick: (
    event:
      | React.MouseEvent<HTMLDivElement>
      | React.KeyboardEvent<HTMLDivElement>,
    index: number,
  ) => void
  activeIndex: number
}

export interface ITabItem {
  name: string
  icon: string
}
