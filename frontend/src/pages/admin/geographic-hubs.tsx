export async function getServerSideProps() { return { redirect: { destination: '/admin/curated?tab=hubs', permanent: true } }; }
export default function HubsRedirect() { return null; }