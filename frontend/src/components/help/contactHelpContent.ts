interface HelpQuestion {
  question: string;
  paragraphs: string[];
  links?: Array<{ label: string; href: string }>;
}

interface HelpGroup {
  id: string;
  title: string;
  questions: HelpQuestion[];
}

export const contactEmail = 'contact@highlandeventshub.co.uk';
export const contactMailto = `mailto:${contactEmail}`;
export const listingMailto = `${contactMailto}?subject=${encodeURIComponent('Done-for-you event listing')}`;

export const contactHelpGroups: HelpGroup[] = [
  { id: 'event-questions', title: 'Questions about an event', questions: [
    { question: 'Does Highland Events Hub organise the events listed on the site?', paragraphs: [
      'No. Highland Events Hub is an event discovery platform. Events are run by independent organisers, venues, businesses, charities, community groups and other organisations.',
      'If you need information about a specific event, please contact the organiser or venue directly.',
    ] },
    { question: 'How do I find the event organiser?', paragraphs: [
      'Check the event page first. Where organiser information is available, the organiser will be linked from the listing.',
      'Some events also link to an organisation or group page where you can find more information about who is running the event.',
    ] },
    { question: 'How do I contact the venue?', paragraphs: [
      'Where a venue is linked to an event, you can visit the venue page on Highland Events Hub for the information available there.',
      'For questions about venue facilities, accessibility, parking, opening times or other venue-specific matters, contact the venue directly.',
    ] },
    { question: 'Has an event been cancelled or changed?', paragraphs: [
      'Event information can change after it has been published. Highland Events Hub may not always be notified immediately.',
      'Check the event listing and any organiser, venue or booking links provided. If you are unsure, contact the organiser directly before travelling.',
    ] },
    { question: 'Can I pay on the door?', paragraphs: [
      'That depends on the individual event. Highland Events Hub cannot confirm door sales unless the organiser has specifically included that information in the event listing.',
      'Please contact the organiser or venue if it is not stated on the event page.',
    ] },
    { question: 'Is an event sold out?', paragraphs: [
      'Ticket availability is controlled by the organiser or ticket provider.',
      'If tickets are sold through an external booking site, use the booking link on the event page for the latest availability.',
      'For events using Highland Events Hub ticketing, current availability will be shown through the HEH ticketing flow.',
    ] },
    { question: 'The information on an event is wrong. What should I do?', paragraphs: [
      'Please let me know if you spot information that appears to be incorrect.',
      'If you are the organiser, venue or another authorised person connected with the event, please say so when getting in touch so I can help make sure the listing is corrected or properly managed.',
    ] },
  ] },
  { id: 'adding-events', title: 'Adding & managing events', questions: [
    { question: 'Is it free to add an event?', paragraphs: ['Yes. Adding and managing your own event on Highland Events Hub is completely free.'] },
    { question: 'How do I add an event?', paragraphs: ['Create or sign in to your Highland Events Hub account and use the Add Event form.'],
      links: [{ label: 'Add an event', href: '/create-event' }, { label: 'Create an account', href: '/register' }, { label: 'Sign in', href: '/login' }] },
    { question: 'What kind of events can I add?', paragraphs: [
      'Highland Events Hub is for events taking place across the Highlands and the areas currently covered by the platform.',
      'Events should be genuine activities that people can attend, book, watch or participate in.',
    ] },
    { question: 'Can I edit my event after publishing it?', paragraphs: [
      'Yes. Events added through your account can be updated if details change.',
      'Keeping your listing accurate is important, particularly if the venue, date, time, price or booking arrangements change.',
    ] },
    { question: 'Can I add a free event?', paragraphs: ['Yes. Free events are welcome on Highland Events Hub.'] },
    { question: 'Can I add recurring or regular events?', paragraphs: [
      'Yes. Use the event form to choose a repeating schedule or several dates and enter the relevant details.',
      'Native HEH ticketing is currently limited to one-off events; recurring and several-date listings can use free entry, pay-at-door or external booking options.',
    ] },
    { question: 'Can Highland Events Hub add the event for me?', paragraphs: [
      'Yes. Adding your own event is completely free, but if you are short on time I can create the listing for you for £10 per event.',
      'You will need to provide the event information and remain responsible for letting me know if any of the details change.',
    ], links: [{ label: 'Ask about a done-for-you listing', href: listingMailto }] },
    { question: 'Why should I add my event if it is already on Facebook or Eventbrite?', paragraphs: [
      'Highland Events Hub is specifically designed to help people discover events taking place across the Highlands.',
      'Listing your event gives it another route to be found by people actively looking for things to do, while allowing you to link visitors back to your own website or booking page.',
    ] },
  ] },
  { id: 'tickets-bookings', title: 'Tickets & bookings', questions: [
    { question: 'Does Highland Events Hub offer ticketing?', paragraphs: [
      'Yes. Organisers can use Highland Events Hub ticketing for both free and paid ticketed events.',
      'Native HEH ticketing currently supports one-off events lasting up to 36 hours. Check the event listing for available booking options.',
    ] },
    { question: 'Do I need to use HEH ticketing to list an event?', paragraphs: [
      'No. Ticketing is optional.',
      'You can list an event and send visitors to your own website, Eventbrite or another external booking service if you prefer.',
    ] },
    { question: 'Can I use HEH for free tickets with limited capacity?', paragraphs: [
      'Yes. Free HEH tickets can be used when visitors need to reserve a place even though no payment is required.',
      'You can set the available capacity and manage registrations through Highland Events Hub.',
    ] },
    { question: 'Do free tickets require Stripe?', paragraphs: ['No. Stripe is not required for free Highland Events Hub tickets.'] },
    { question: 'How do paid HEH tickets work?', paragraphs: [
      'For paid tickets, organisers connect their own Stripe account. Ticket payments are processed securely and payouts go directly through Stripe to the organiser.',
    ] },
    { question: 'Is Highland Events Hub ticketing cheaper than Eventbrite?', paragraphs: [
      'Highland Events Hub has been designed to offer straightforward, lower-cost ticketing for Highland event organisers. Current fees are shown as part of the HEH ticketing information and setup process.',
    ], links: [{ label: 'HEH ticketing information', href: '/sell-tickets' }] },
    { question: 'Can I still use an external booking site?', paragraphs: [
      'Yes. Choose the external booking option when adding your event and provide the booking URL.',
      'You can also enter the ticket price or price information shown on Highland Events Hub.',
    ] },
  ] },
  { id: 'organisations-venues', title: 'Organisations & venues', questions: [
    { question: 'What is an organisation page?', paragraphs: [
      'Organisation pages give groups, businesses, promoters, charities and other event organisers a home on Highland Events Hub.',
      'They help visitors find your events and understand who is behind them.',
    ], links: [{ label: 'Find organisations', href: '/groups' }] },
    { question: 'What is a venue page?', paragraphs: [
      'Venue pages provide a dedicated place for venues on Highland Events Hub and help visitors discover events happening there.',
    ], links: [{ label: 'Find venues', href: '/venues' }] },
    { question: 'Why should I keep my organisation or venue page updated?', paragraphs: [
      'Accurate organisation and venue information helps event-goers reach the right people when they have questions.',
      'It also gives visitors a useful place to discover your other events.',
    ] },
    { question: 'My organisation or venue is already listed. Can I manage it?', paragraphs: [
      'For a venue, sign in and use the Claim Venue button on its page to request management access. Requests are reviewed before access is granted.',
      'For an organisation or group that is already listed, contact me and explain your connection to it so I can help with management access. Existing owners and authorised team members can manage their organisation page.',
    ], links: [{ label: 'Contact me about management access', href: contactMailto }] },
  ] },
  { id: 'promotion', title: 'Promotion & working with HEH', questions: [
    { question: 'Can Highland Events Hub promote my event?', paragraphs: [
      'Yes. Highland Events Hub offers additional promotional opportunities alongside free event listings.',
      'Get in touch if you would like to discuss featured promotion or other ways to increase the visibility of an event.',
    ] },
    { question: 'Can my event be included in the weekly Top Highland Events feature?', paragraphs: [
      'The weekly feature highlights a selection of upcoming events based on factors including interest on Highland Events Hub, event variety and geographical spread.',
      'Inclusion is not guaranteed.',
    ] },
    { question: 'Can my event be featured in a Highland Events Hub email?', paragraphs: [
      'Selected events can be featured in Highland Events Hub emails to registered users.',
      'Get in touch if you would like to discuss an email feature.',
    ] },
    { question: 'Do you work with BIDs, tourism groups or community organisations?', paragraphs: [
      'Yes. Highland Events Hub works with local organisations to improve event coverage and help people discover what is happening in different parts of the Highlands.',
      'If you represent a BID, tourism organisation, community group or similar organisation and would like to discuss working together, please get in touch.',
    ] },
  ] },
  { id: 'accounts', title: 'Accounts & general help', questions: [
    { question: 'Do I need an account to browse events?', paragraphs: ['No. You can browse and search events without creating an account.'] },
    { question: 'Do I need an account to add an event?', paragraphs: ['Yes. An account is required to create and manage event listings.'] },
    { question: 'I am having trouble with my account. What should I do?', paragraphs: [
      'If you cannot resolve the problem through the normal sign-in or account options, contact Highland Events Hub and include the email address associated with your account.',
      'Do not send passwords or other sensitive login information by email.',
    ], links: [{ label: 'Sign in', href: '/login' }] },
    { question: 'How quickly will I get a reply?', paragraphs: [
      'Highland Events Hub is run independently alongside my full-time job, so replies may not always be immediate.',
      'Please allow a few days for a response.',
    ] },
    { question: 'I have found a problem with the website. Can I report it?', paragraphs: [
      'Yes. If something on Highland Events Hub is not working as expected, please get in touch and include a short description of the problem and the page where it happened.',
    ] },
  ] },
];
