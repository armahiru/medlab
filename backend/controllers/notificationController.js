const Notification = require('../models/Notification');

async function listNotifications(req, res, next) {
  try {
    const notifications = await Notification.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    const unreadCount = await Notification.countDocuments({
      user: req.user._id,
      read: false,
    });

    return res.status(200).json({
      unreadCount,
      count: notifications.length,
      notifications,
    });
  } catch (err) {
    return next(err);
  }
}

async function unreadCount(req, res, next) {
  try {
    const count = await Notification.countDocuments({
      user: req.user._id,
      read: false,
    });
    return res.status(200).json({ unreadCount: count });
  } catch (err) {
    return next(err);
  }
}

async function markRead(req, res, next) {
  try {
    const notification = await Notification.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!notification) {
      return res.status(404).json({ message: 'Notification not found.' });
    }

    notification.read = true;
    await notification.save();

    return res.status(200).json({ message: 'Marked as read.', notification });
  } catch (err) {
    return next(err);
  }
}

async function markAllRead(req, res, next) {
  try {
    await Notification.updateMany(
      { user: req.user._id, read: false },
      { $set: { read: true } }
    );

    return res.status(200).json({ message: 'All notifications marked as read.' });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  listNotifications,
  unreadCount,
  markRead,
  markAllRead,
};
