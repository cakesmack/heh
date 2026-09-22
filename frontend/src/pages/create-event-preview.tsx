import type { GetServerSideProps } from 'next';
import Head from 'next/head';
import GuidedEventFormPreview from '@/components/events/guided/GuidedEventFormPreview';

export const isGuidedPreviewAvailable = (environment = process.env.NODE_ENV) => environment !== 'production';

export const getServerSideProps: GetServerSideProps = async () => {
  if (!isGuidedPreviewAvailable()) return { notFound: true };
  return { props: {} };
};

export default function CreateEventPreviewPage() {
  return (
    <>
      <Head>
        <title>Guided Event Form Preview | Highland Events Hub</title>
        <meta name="robots" content="noindex,nofollow" />
        <meta name="description" content="Development-only preview of the guided Highland Events Hub event form." />
      </Head>
      <GuidedEventFormPreview />
    </>
  );
}
