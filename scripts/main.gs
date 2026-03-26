function doGet(e) {
  const action = e.parameter.action;
  
  if (action === 'wclAuth' || action === 'wclQuery') {
    return handleWcl(e);
  }
  if (e.parameter.itemId) {
    return handleIconLookup(e);
  }
  return handleProxy(e);
}
