import type { TourStep } from "@/components/CoachTour";

// Targets are `data-tour="..."` attributes on the page. Steps whose target is missing (e.g. no messages yet) are skipped.
export const HOME_TOUR: TourStep[] = [
  { target: "home-search", title: "Search anything", body: "Type what you need, like braids, a logo or kota, and we'll find student hustles that match." },
  { target: "home-campus", title: "Pick your campus", body: "Switch campus to see the hustles closest to you, or keep All to browse nationwide." },
  { target: "home-categories", title: "Shop by category", body: "Food, beauty, tutoring, design and more. Tap a category to jump straight in." },
  { target: "nav", title: "Get around", body: "Browse, Sell, Messages and your Account are always one tap away." },
];

export const BROWSE_TOUR: TourStep[] = [
  { target: "browse-search", title: "Search listings", body: "Search by product, service or seller name. Small typos are fine." },
  { target: "browse-filters", title: "Narrow it down", body: "Filter by category, campus, price and whether it's a product or a service." },
  { target: "browse-results", title: "Open a listing", body: "Tap a listing to see photos, price and pickup points, then message the seller." },
];

export const MESSAGES_TOUR: TourStep[] = [
  { target: "inbox", title: "Your conversations", body: "Every enquiry lives here. New messages appear instantly, and unread chats are marked." },
];

export const SELLER_TOUR: TourStep[] = [
  { target: "status", title: "1. Your status", body: "See whether your profile is waiting for approval or live. Approved sellers get the Verified Incubation Hub badge from the team." },
  { target: "listings", title: "2. Your listings", body: "Create products or services with photos and a price in rand. Pause or mark sold out anytime." },
  { target: "profile", title: "3. Your public profile", body: "This is what buyers see. Keep your photo, bio and pickup points fresh to win trust." },
];

export const TOUR_IDS = ["home", "browse", "messages", "seller"] as const;
