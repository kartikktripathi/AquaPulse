export function splitPhotos(photos) {
  let list = photos;
  if (typeof list === 'string') {
    try {
      list = JSON.parse(list);
    } catch (e) {
      list = [list];
    }
  }
  if (!Array.isArray(list)) {
    list = list ? [list] : [];
  }

  const before = [];
  const after = [];

  list.forEach(function (item) {
    if (!item) {
      return;
    }
    const url = typeof item === 'string' ? item : item.uri || item.url || '';
    if (typeof url === 'string' && url.endsWith('#after')) {
      after.push(item);
    } else {
      before.push(item);
    }
  });

  return { before: before, after: after };
}

export default splitPhotos;

