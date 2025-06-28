export const StatCard = ({ label, value, mainStyle = false }: { label: string; value: string | number; mainStyle?: boolean }) => (
    <div className={`p-4 border rounded-lg ${mainStyle ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white'}`}>
        <p className={`text-sm ${mainStyle ? 'text-blue-700' : 'text-gray-500'}`}>{label}</p>
        <p className={`text-2xl font-bold ${mainStyle ? 'text-blue-600' : 'text-gray-800'}`}>{value}</p>
    </div>
);