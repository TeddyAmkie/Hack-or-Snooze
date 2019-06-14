$(async function () {
  // cache some selectors we'll be using quite a bit
  const $allStoriesList = $("#all-articles-list");
  const $submitForm = $("#submit-form");
  const $filteredArticles = $("#filtered-articles");
  const $loginForm = $("#login-form");
  const $createAccountForm = $("#create-account-form");
  const $navLogin = $("#nav-login");
  const $navLogOut = $("#nav-logout");
  const $navSubmitStory = $("#nav-submit-story");
  const $navOpenFavorites = $("#nav-open-favorites");
  const $navUserStories = $("#nav-user-stories");

  // global storyList variable
  let storyList = null;

  // global currentUser variable
  let currentUser = null;

  await checkIfLoggedIn();


  /***********************************************************************************/
  /********************************* EVENT LISTENERS *********************************/
  /***********************************************************************************/

  /**
   * Event listener for logging in.
   *  If successfully we will setup the user instance
   */

  $loginForm.on("submit", async function (evt) {
    evt.preventDefault(); // no page-refresh on submit

    // grab the username and password
    const username = $("#login-username").val();
    const password = $("#login-password").val();


    // call the login static method to build a user instance
    const userInstance = await User.login(username, password);
    // set the global user to the user instance
    currentUser = userInstance;
    syncCurrentUserToLocalStorage();
    loginAndSubmitForm();
  });

  /**
   * Event listener for signing up.
   *  If successfully we will setup a new user instance
   */

  $createAccountForm.on("submit", async function (evt) {
    evt.preventDefault(); // no page refresh

    // grab the required fields
    let name = $("#create-account-name").val();
    let username = $("#create-account-username").val();
    let password = $("#create-account-password").val();

    // call the create method, which calls the API and then builds a new user instance
    const newUser = await User.create(username, password, name);
    currentUser = newUser;
    syncCurrentUserToLocalStorage();
    loginAndSubmitForm();
  });

  /**
   * Log Out Functionality
   */

  $navLogOut.on("click", function () {
    // empty out local storage
    localStorage.clear();
    // refresh the page, clearing memory
    location.reload();
  });

  /**
   * Event Handler for Clicking Login
   */

  $navLogin.on("click", function () {
    // Show the Login and Create Account Forms
    $loginForm.slideToggle();
    $createAccountForm.slideToggle();
    $allStoriesList.toggle();
  });


  //Event Handler for Clicking Submit
  $navSubmitStory.on("click", function () {
    //Show story submission form
    $submitForm.slideToggle();
  })

  // Event Handler for story form submission
  $submitForm.on("submit", async function (evt) {
    evt.preventDefault(); // no page-refresh on submit

    let author = $("#author").val();
    let title = $("#title").val();
    let url = $("#url").val();
    let newStoryObject = { author, title, url };

    const newStory = await storyList.addStory(currentUser, newStoryObject);
    // Reset Form and update DOM
    $("#submit-form").trigger("reset");
    $submitForm.slideToggle();
    let newStoryHTML = generateStoryHTML(newStory.story);

    // Adds delete icon to submitted story
    newStoryHTML.prepend("<i class='fas fa-trash-alt delete-button'></i>");
    // Adds story to list
    $allStoriesList.prepend(newStoryHTML);
  });

  //Event Handler for Favorites Button
  $navOpenFavorites.on("click", async function () {
    hideElements();
    generateFavStories();
    $allStoriesList.show();
  });

  //Event Handler for User Stories
  $navUserStories.on("click", async function () {
    hideElements();
    generateUserStories();
    $allStoriesList.show();
  })

  //Event Handler for trash can
  //Deletes stories from My Stories

  $(".articles-container").on("click", ".delete-button", function (evt) {
    let storyID = evt.target.closest("li").id;
    currentUser.deleteStory(storyID);
    $(`#${storyID}`).remove();
  })

  //adds event Handler for clicking stars
  //favorites or unfavorites story accordingly
  $(".articles-container").on("click", ".fav-button", function (evt) {
    let storyID = evt.target.closest("li").id;

    if (!isFavoriteStory(storyID)) {
      currentUser.favoriteStory(storyID);
    }
    else {
      currentUser.unfavoriteStory(storyID);
    }
    //change icon
    $(this).toggleClass("fas far");
  });


  /**
   * Event handler for Navigation to Homepage
   */

  $("body").on("click", "#nav-all", async function () {
    hideElements();
    await generateStories();
    $allStoriesList.show();
  });


  /***********************************************************************************/
  /*************************** LOG-INS AND AUTHENTICATION ****************************/
  /***********************************************************************************/

  /**
   * On page load, checks local storage to see if the user is already logged in.
   * Renders page information accordingly.
   */

  async function checkIfLoggedIn() {
    // let's see if we're logged in
    const token = localStorage.getItem("token");
    const username = localStorage.getItem("username");

    // if there is a token in localStorage, call User.getLoggedInUser
    //  to get an instance of User with the right details
    //  this is designed to run once, on page load
    currentUser = await User.getLoggedInUser(token, username);
    await generateStories();

    if (currentUser) {
      showNavForLoggedInUser();
    }
  }

  /**
   * A rendering function to run to reset the forms and hide the login info
   */

  function loginAndSubmitForm() {
    // hide the forms for logging in and signing up
    $loginForm.hide();
    $createAccountForm.hide();

    // reset those forms
    $loginForm.trigger("reset");
    $createAccountForm.trigger("reset");

    // show the stories
    $allStoriesList.show();

    // update the navigation bar
    showNavForLoggedInUser();
  }


  /***********************************************************************************/
  /************************************* STORIES *************************************/
  /***********************************************************************************/

  /**
   * A rendering function to call the StoryList.getStories static method,
   *  which will generate a storyListInstance. Then render it.
   */

  async function generateStories() {
    // get an instance of StoryList
    const storyListInstance = await StoryList.getStories();
    // update our global variable
    storyList = storyListInstance;
    // empty out that part of the page
    $allStoriesList.empty();

    // loop through all of our stories and generate HTML for them
    for (let story of storyList.stories) {
      const result = generateStoryHTML(story);
      //if story is favorited, fill in star
      if (isFavoriteStory(story.storyId)) {
        $(result).find("i").toggleClass("fas far");
      }
      //if story is owned, add trashcan
      if (isOwnedStory(story.storyId)) {
        $(result).prepend("<i class='fas fa-trash-alt delete-button'></i>");
      }

      $allStoriesList.append(result);
    }
  }

  //Returns true if input storyID is contained in user's owned stories
  function isOwnedStory(storyID){
    return currentUser.ownStories.some(story => story.storyId === storyID);
  }

  //Accesses current user favorites to replace $allStoriesList
  function generateFavStories() {
    $allStoriesList.empty()
    for (let story of currentUser.favorites) {
      let storyHTML = generateStoryHTML(story);

      //change all empty stars to full for favorite stories list
      $(storyHTML).find("i").toggleClass("fas far");
      //Adds delete button if user owned story
      if(isOwnedStory(story.storyId)){
        storyHTML.prepend("<i class='fas fa-trash-alt delete-button'></i>")
      }

      $allStoriesList.append(storyHTML);
    }
  }

  // Access current user's stories to replace $allStoriesList
  function generateUserStories() {
    $allStoriesList.empty();
    for (let story of currentUser.ownStories) {
      let storyHTML = generateStoryHTML(story);
      storyHTML.prepend("<i class='fas fa-trash-alt delete-button'></i>")
      
      if(isFavoriteStory(story.storyId)){
        $(storyHTML).find(".fav-button").toggleClass("fas far");
      }
      $allStoriesList.prepend(storyHTML);
    }
  }



  /**
   * A function to render HTML for an individual Story instance
   */

  function generateStoryHTML(story) {
    let hostName = getHostName(story.url);

    // render story markup
    const storyMarkup = $(`
      <li id="${story.storyId}">
        <i class="far fa-star fav-button"></i>
        <a class="article-link" href="${story.url}" target="a_blank">
          <strong>${story.title}</strong>
        </a>
        <small class="article-author">by ${story.author}</small>
        <small class="article-hostname ${hostName}">(${hostName})</small>
        <small class="article-username">posted by ${story.username}</small>
      </li>
    `);

    return storyMarkup;
  }

  /***********************************************************************************/
  /******************************** HELPER FUNCTIONS *********************************/
  /***********************************************************************************/

  //helper function for generateStories, returns true if input matches ID in currentUser.favorites
  function isFavoriteStory(storyID) {
    let favoriteStories = currentUser.favorites;
    return favoriteStories.some(story => story.storyId === storyID);
  }

  /* hide all elements in elementsArr */

  function hideElements() {
    const elementsArr = [
      $submitForm,
      $allStoriesList,
      $filteredArticles,
      $loginForm,
      $createAccountForm
    ];
    elementsArr.forEach($elem => $elem.hide());
  }

  function showNavForLoggedInUser() {
    $navLogin.hide();
    $navLogOut.show();
    $navSubmitStory.show();
    $navOpenFavorites.show();
    $navUserStories.show();
  }

  /* simple function to pull the hostname from a URL */

  function getHostName(url) {
    let hostName;
    if (url.indexOf("://") > -1) {
      hostName = url.split("/")[2];
    } else {
      hostName = url.split("/")[0];
    }
    if (hostName.slice(0, 4) === "www.") {
      hostName = hostName.slice(4);
    }
    return hostName;
  }

  /* sync current user information to localStorage */

  function syncCurrentUserToLocalStorage() {
    if (currentUser) {
      localStorage.setItem("token", currentUser.loginToken);
      localStorage.setItem("username", currentUser.username);
    }
  }
});
