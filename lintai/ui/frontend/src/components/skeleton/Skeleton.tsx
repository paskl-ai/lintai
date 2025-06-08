const Skeleton = ({ className = '' }) => {
  return (
    <div className={`bg-primaryContainer animate-pulse rounded ${className}`} />
  )
}

export default Skeleton
