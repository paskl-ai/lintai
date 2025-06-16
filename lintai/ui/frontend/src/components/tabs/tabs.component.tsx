import type { ITab, ITabItem } from './tabs.interface'

const Tabs = ({ items, onClick, activeIndex }: ITab) => {
  return (
    <>
      <div className="container mx-auto">
        <div className="flex gap-3 overflow-x-auto p-4 whitespace-nowrap md:justify-center">
          {items.map((item: ITabItem, index: number) => {
            return (
              <div
                key={index}
                role="button"
                tabIndex={0}
                onClick={(e: React.MouseEvent<HTMLDivElement>) =>
                  onClick(e, index)
                }
                onKeyDown={(e: React.KeyboardEvent<HTMLDivElement>) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    onClick(e, index)
                  }
                }}
                className={`flex cursor-pointer items-center justify-between gap-2 px-3 py-2 pr-10 pb-1 ${
                  activeIndex === index
                    ? 'border-b-green border-b-2 border-solid'
                    : 'opacity-20'
                }`}
              >
                <img
                  alt="lazy"
                  loading="lazy"
                  src={item.icon}
                  className="aspect-square w-6 max-w-full shrink-0 object-contain object-center"
                />
                <div>
                  <span className="my-auto self-center text-center text-base leading-4 font-semibold tracking-wide text-neutral-800 capitalize">
                    {item.name}
                  </span>
                </div>
              </div>
            )
          })}

          {/* <div className="flex items-center gap-2 pr-10 justify-between px-3 py-2 opacity-20">
            <img
              alt="lazy"
              loading="lazy"
              src="assets/icons/gift_pack.svg"
              className="aspect-square object-contain object-center w-6 overflow-hidden shrink-0 max-w-full"
            />
            <div className="">
              <span className="text-neutral-800 text-center text-base font-semibold leading-4 tracking-wide capitalize self-center my-auto">
                For Someone Else
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 pr-10 justify-between opacity-20 px-3 py-2">
            <img
              alt="lazy"
              loading="lazy"
              src="assets/icons/green_tick_full.svg"
              className="aspect-square object-contain object-center w-6 overflow-hidden shrink-0 max-w-full"
            />
            <div>
              <span className="text-neutral-800 text-center text-base font-semibold leading-4 tracking-wide capitalize self-center my-auto">
                Reedme A Code
              </span>
            </div>
          </div> */}
        </div>
      </div>
    </>
  )
}

export default Tabs
