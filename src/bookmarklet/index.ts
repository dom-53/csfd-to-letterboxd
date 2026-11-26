import { runBookmarklet } from './bookmarklet';

void runBookmarklet({
  document,
  url: location.href,
  navigate: (url) => location.assign(url),
  notify: (message) => alert(message),
});
