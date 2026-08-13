export async function getServerSideProps() { return { redirect: { destination: '/admin/venues?tab=categories', permanent: true } }; }
export default function VenueCategoriesRedirect() { return null; }