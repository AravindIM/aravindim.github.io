import type { Site, SocialObjects } from "./types";

export const SITE: Site = {
  website: "https://aravindim.gitlab.page/", // replace this with your deployed domain
  author: "Aravind I M",
  desc: "Personal homepage of AIM",
  title: "AIM",
  ogImage: "astropaper-og.jpg",
  lightAndDarkMode: true,
  postPerPage: 3,
};

export const LOCALE = ["en-EN"]; // set to [] to use the environment default

export const LOGO_IMAGE = {
  enable: false,
  svg: true,
  width: 216,
  height: 46,
};

export const SOCIALS: SocialObjects = [
  {
    name: "Github",
    href: "https://github.com/AravindIM",
    linkTitle: ` ${SITE.title} on Github`,
    active: true,
  },
  {
    name: "GitLab",
    href: "https://gitlab.com/AravindIM",
    linkTitle: `${SITE.title} on Gitlab`,
    active: true,
  },
  {
    name: "Mastodon",
    href: "https://mastodon.social/@aravindim",
    linkTitle: `${SITE.title} on Mastodon`,
    active: true,
  },
  {
    name: "LinkedIn",
    href: "https://linkedin.com/in/aravindim",
    linkTitle: `${SITE.title} on LinkedIn`,
    active: true,
  },
  {
    name: "Mail",
    href: "mailto:aravindim@yahoo.com",
    linkTitle: `Send an email to ${SITE.title}`,
    active: true,
  },
];
