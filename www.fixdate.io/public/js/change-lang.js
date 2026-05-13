(function() {
  function setCountryCookie(country) {
    if (!country) {
      return;
    }
    var value = country.toUpperCase();
    var maxAge = 60 * 60 * 24 * 180;
    document.cookie = 'fixdate_country=' + value + ';path=/;max-age=' + maxAge + ';SameSite=Lax';
  }

  $('.flags-laguages .change-lang').each(function() {
    var $link = $(this);
    var country = $link.attr('country');
    var currentUrl = window.location.href;
    var regex = /\/(\w{2})(\/|$)/;

    if (country) {
      var newUrl;
      if (regex.test(currentUrl)) {
        newUrl = currentUrl.replace(regex, '/' + country + '$2');
      } else {
        newUrl = currentUrl.replace(/\/$/, '') + '/' + country + '/';
      }
      $link.attr('href', newUrl);
    }

    $link.on('click', function() {
      setCountryCookie(country);
    });
  });
})();