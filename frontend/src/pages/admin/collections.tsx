export async function getServerSideProps() { return { redirect: { destination: '/admin/curated?tab=collections', permanent: true } }; }
export default function CollectionsRedirect() { return null; }