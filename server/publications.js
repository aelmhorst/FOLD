Stories._ensureIndex({
  shortId: 1
}, {
  unique: 1
});

Stories._ensureIndex({
  published: 1
});

Stories._ensureIndex({
  deleted: 1
});

Stories._ensureIndex({
  authorId: 1
});

ContextBlocks._ensureIndex({
  authorId: 1
});

StoryStats._ensureIndex({
  storyId: 1
});

Meteor.users._ensureIndex({
  username: 1
});

var readStoryFields = {
  draftStory: 0,
  history: 0,
  narrativeRightsReserved: 0,
  //savedAt: 0, // used in analytics
  //createdAt:0, // used in analytics
  everPublished:0,
  //deleted: 0, // currently always blank so no need to filter
  //deletedAt: 0, // currently always blank so no need to filter
  'analytics.shares': 0,
  //'contextBlocks.authorId': 0, // used in analytics
  //'contextBlocks.storyShortId': 0, // used in analytics
  'contextBlocks.storyId': 0,
  'contextBlocks.version': 0,
  'contextBlocks.savedAt': 0,
  'contextBlocks.publishedAt': 0,
  'contextBlocks.createdAt': 0,
  'contextBlocks.fullDetails': 0,
  'contextBlocks.published': 0,
  'contextBlocks.everPublished': 0,
  'contextBlocks.searchQuery': 0,
  'contextBlocks.searchOption': 0
};

var previewStoryFields = {
  shortId: 1,
  savedAt: 1,
  publishedAt: 1,
  published: 1,
  userPathSegment: 1,
  authorId: 1,
  authorName: 1,
  //authorUsername: 1, // don't need atm. can get from lowercasing the below
  authorDisplayUsername: 1,
  //favorited: 1, // will need to add this back in for non-curated stories to use preview
  editorsPick: 1,
  editorsPickAt: 1,
  //'analytics.views': 1,  // will need to add this back in for non-curated stories to use preview
  contextBlockTypeCount: 1,
  headerImageFormat: 1,
  headerImage: 1,
  favoritedTotal: 1,
  storyPathSegment: 1,
  title: 1
};


// add preview fields again but nested under draftStory. also authorUsername until migrate
var previewStoryFieldsWithDraft = _.extend({}, previewStoryFields, _.chain(previewStoryFields).keys().map(function(fieldName){return 'draftStory.' + fieldName}).object(_.values(previewStoryFields)).value(), {'authorUsername': 1});

Meteor.publish("curatedStoriesPub", function(options) {
  options = options ? options : {};
  _.defaults(options, {page: 0});

  return Stories.find({
    published: true,
    editorsPick: true
  }, {
    fields: options.preview ? previewStoryFields : readStoryFields,
    skip: options.page * PUB_SIZE,
    sort: {
      editorsPickAt: -1
    },
    limit: PUB_SIZE
  });
});

Meteor.publish("newestStoriesPub", function(options) { // for now, it's just publishedAt (later should maybe be firstPublishedAt)
  options = options ? options : {};
  _.defaults(options, {page: 0});
  return Stories.find({
    published: true
  }, {
    fields: readStoryFields,
    skip: options.page * PUB_SIZE,
    sort: {
      publishedAt: -1
    },
    limit: PUB_SIZE
  });
});

Meteor.publish("trendingStoriesPub", function(options) { // for now, it's just the most views
  options = options ? options : {};
  _.defaults(options, {page: 0});
  return Stories.find({
    published: true
  }, {
    fields: readStoryFields,
    skip: options.page * PUB_SIZE,
    sort: {
      'analytics.views.total': -1
    },
    limit: PUB_SIZE
  });
});

Meteor.publish("starredStoriesPub", function(options) {
  options = options ? options : {};
  _.defaults(options, {page: 0});
  return Stories.find({
    published: true,
    fields: readStoryFields,
    skip: options.page * PUB_SIZE,
    sort: {
      'favoritedTotal': -1
    },
    limit: PUB_SIZE
  });
});

Meteor.publish("favoriteStoriesPub", function(ids) { // requires ids to be passed in
  return Stories.find({
    published: true,
    _id: { $in : ids }
  }, {
    fields: readStoryFields,
    sort: {
      publishedAt: -1
    },
    limit: PUB_SIZE
  });
});

Meteor.publish("readStoryPub", function(userPathSegment, shortId) {
  return Stories.find({
    userPathSegment: userPathSegment,
    shortId: shortId,
    published: true
  }, {
    fields: readStoryFields
  });
});

Meteor.publish("createStoryPub", function(userPathSegment, shortId) {
  return Stories.find({
    userPathSegment: userPathSegment,
    shortId: shortId,
    deleted: {$ne: true}
  }, {
    fields: {
      history: 0
    }
  });
});

Meteor.publish("contextBlocksPub", function(storyShortId) {
  if(!storyShortId || !this.userId){
    return this.ready();
  }
  return ContextBlocks.find({
    storyShortId: storyShortId,
    authorId: this.userId,
    deleted: {$ne: true}
  },{
    fields : {
      fullDetails: 0
    },
    limit: 1000
  });
});

Meteor.publish("minimalUsersPub", function(userIds) {
  if (!userIds || !userIds.length || userIds.length > 1000) {
    return this.ready();
  }
  return Meteor.users.find({_id: {
    $in: userIds
  }}, {
    fields: {
      "profile.profilePicture": 1,
      "username": 1,
      "services.twitter.id": 1
    }
  });
});

Meteor.publish("userProfilePub", function(username) { // includes user profile and published stories

  userCursor = Meteor.users.find({
    username: username.toLowerCase()
  }, {
    fields: {
      "profile" : 1,
      "username" : 1,
      "displayUsername" : 1,
      "services.twitter.id": 1
    }
  });

  var user = userCursor.fetch()[0];

  if (!user){
    return this.ready();
  }

  var userFavorites = user.profile.favorites || [];
  return [
    userCursor,
    Stories.find({
      _id: {
        $in: userFavorites
      },
      published: true
    }, {
      fields : previewStoryFields,
      limit: 100 // initial limit
  })]
});

Meteor.publish("userStoriesPub", function(username) { // only published stories
  if (!username) {
    return this.ready();
  }

  return Stories.find({
    authorUsername: username,
    published: true
  },{
    fields : previewStoryFields,
    limit: 100 // initial limit
  });
});

Meteor.publish("myStoriesPub", function() {
  if (this.userId) {
    return Stories.find({
      authorId: this.userId,
      deleted: {$ne: true}
    }, {
      fields: previewStoryFieldsWithDraft,
      limit: 1000 // initial limit
    });
  } else {
    return this.ready();
  }
});

Meteor.publish("userData", function () {
  if (this.userId) {
    return Meteor.users.find({_id: this.userId},
      {fields: {
        'accessPriority': 1,
        "services.twitter.id": 1,
        "displayUsername": 1,
        "admin": 1,
        "profile": 1
      }});
  } else {
    this.ready();
  }
});


// this publishes info on server facts (used on /stats page)
Facts.setUserIdFilter(function (userId) {
  var user = Meteor.users.findOne(userId);
  return user && user.admin;
});
