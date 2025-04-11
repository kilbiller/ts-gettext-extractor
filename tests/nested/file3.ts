import { __, __n } from "../gettext";

const greeting = __("Hello");
const farewell = __n("Goodbye", "Goodbyes", 5);
const templateGreeting = __("Hello, ${name}!");
const templateFarewell = __n(`Goodbye, \${name}!`, `Goodbyes, \${name}!`, 5);
const extraArgExample = __("Welcome", "extra argument");
