export const askUserDescription = `Ask the user a multiple-choice question when you can't decide, or need a fact only they know.
- 2 to 4 options. Put the one you recommend first. Each option must be a concrete change to the setup.
- Only offer options you can carry out in this sandbox. If a download already failed with a network error (e.g. ECONNRESET, ENOTFOUND), that host can't be reached, and neither you nor the user can change that: don't offer options that need it.
- The user can always answer in their own words instead.
- At most 5 questions per setup. Don't ask what you can find out yourself.`;
