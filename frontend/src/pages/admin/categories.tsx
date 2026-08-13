export async function getServerSideProps() { return { redirect: { destination: '/admin/events?tab=categories', permanent: true } }; }
export default function CategoriesRedirect() { return null; }