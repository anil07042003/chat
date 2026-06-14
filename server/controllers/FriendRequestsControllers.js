import User from "../models/UserModel.js";

export const createFriendRequest = async (req, res) => {
  try {
    const { friendRequest } = req.body; // target email
    const userId = req.userId;

    if (!friendRequest) {
      return res.status(400).json({ error: "Target email is required" });
    }

    const currentUser = await User.findById(userId).select("email friends friendRequests");
    if (!currentUser) return res.status(404).json({ error: "User not found" });

    if (currentUser.email === friendRequest.toLowerCase().trim()) {
      return res.status(400).json({ error: "Cannot send friend request to yourself" });
    }

    if (currentUser.friends.includes(friendRequest)) {
      return res.status(400).json({ error: "Already friends" });
    }

    const targetUser = await User.findOne({ email: friendRequest.toLowerCase().trim() })
      .select("_id email firstName lastName image friendRequests");
    if (!targetUser) {
      return res.status(404).json({ error: "User not found" });
    }

    if (targetUser.friendRequests.includes(currentUser.email)) {
      return res.status(400).json({ error: "Friend request already sent" });
    }

    await User.findByIdAndUpdate(targetUser._id, {
      $addToSet: { friendRequests: currentUser.email },
    });

    return res.status(201).json({
      message: "Friend request sent",
      target: {
        _id: targetUser._id,
        email: targetUser.email,
        firstName: targetUser.firstName,
        lastName: targetUser.lastName,
        image: targetUser.image,
      },
      requester: {
        _id: currentUser._id,
        email: currentUser.email,
        firstName: currentUser.firstName,
        lastName: currentUser.lastName,
        image: currentUser.image,
      },
    });
  } catch (error) {
    console.error("Create friend request error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const acceptFriendRequest = async (req, res) => {
  try {
    const { friendEmail } = req.body;
    const userId = req.userId;

    if (!friendEmail) return res.status(400).json({ error: "Friend email is required" });

    // Use lean() to just check data — no save() needed
    const currentUser = await User.findById(userId).select("email friendRequests friends").lean();
    if (!currentUser) return res.status(404).json({ error: "User not found" });

    if (!currentUser.friendRequests.includes(friendEmail)) {
      return res.status(400).json({ error: "Friend request not found" });
    }

    const friendUser = await User.findOne({ email: friendEmail })
      .select("_id email firstName lastName image color isOnline friends").lean();
    if (!friendUser) return res.status(404).json({ error: "User not found" });

    // Use atomic $pull / $addToSet — no full document save, no validation issues
    await User.findByIdAndUpdate(userId, {
      $pull:    { friendRequests: friendEmail },
      $addToSet: { friends: friendEmail },
    });

    await User.findByIdAndUpdate(friendUser._id, {
      $addToSet: { friends: currentUser.email },
    });

    return res.status(200).json({
      message: "Friend request accepted",
      newFriend: {
        _id: friendUser._id,
        email: friendUser.email,
        firstName: friendUser.firstName,
        lastName: friendUser.lastName,
        image: friendUser.image,
        color: friendUser.color,
        isOnline: friendUser.isOnline,
      },
    });
  } catch (error) {
    console.error("Accept friend request error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const rejectFriendRequest = async (req, res) => {
  try {
    const { friendRequest } = req.body; // email
    const userId = req.userId;

    if (!friendRequest) return res.status(400).json({ error: "Friend email is required" });

    await User.findByIdAndUpdate(userId, {
      $pull: { friendRequests: friendRequest },
    });

    return res.status(200).json({ message: "Friend request rejected" });
  } catch (error) {
    console.error("Reject friend request error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const getFriendRequests = async (req, res) => {
  try {
    const user = await User.findById(req.userId).select("friendRequests").lean();
    if (!user) return res.status(404).json({ error: "User not found" });

    if (!user.friendRequests || user.friendRequests.length === 0) {
      return res.status(200).json({ friendRequests: [] });
    }

    const requestUsers = await User.find({
      email: { $in: user.friendRequests },
    }).select("email firstName lastName image color username isOnline").lean();

    // Sort newest first (last in array = most recently added)
    const sorted = [...user.friendRequests]
      .reverse()
      .map((email) => requestUsers.find((u) => u.email === email))
      .filter(Boolean);

    return res.status(200).json({ friendRequests: sorted });
  } catch (error) {
    console.error("Get friend requests error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const searchFriendRequests = async (req, res) => {
  try {
    const { searchTerm, friendRequests } = req.body;

    if (!searchTerm || !friendRequests) {
      return res.status(400).json({ error: "searchTerm and friendRequests are required" });
    }

    // Properly escape regex special characters
    const sanitized = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(sanitized, "i");
    const emails = friendRequests.map((r) => r.email);

    const results = await User.find({
      email: { $in: emails },
      $or: [
        { firstName: regex },
        { lastName: regex },
        { email: regex },
        {
          $expr: {
            $regexMatch: {
              input: { $concat: ["$firstName", " ", "$lastName"] },
              regex: sanitized,
              options: "i",
            },
          },
        },
      ],
    }).select("email firstName lastName image color").lean();

    return res.status(200).json({ searchedFriendRequests: results });
  } catch (error) {
    console.error("Search friend requests error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const removeFriend = async (req, res) => {
  try {
    const { friendEmail } = req.body;
    const userId = req.userId;

    if (!friendEmail) return res.status(400).json({ error: "Friend email is required" });

    const currentUser = await User.findById(userId).select("email").lean();
    if (!currentUser) return res.status(404).json({ error: "User not found" });

    const friendUser = await User.findOne({ email: friendEmail }).select("_id email").lean();
    if (!friendUser) return res.status(404).json({ error: "Friend not found" });

    // Atomic updates — no .save(), no validation issues
    await User.findByIdAndUpdate(userId, {
      $pull: { friends: friendEmail },
    });

    await User.findByIdAndUpdate(friendUser._id, {
      $pull: { friends: currentUser.email },
    });

    return res.status(200).json({ message: "Friend removed" });
  } catch (error) {
    console.error("Remove friend error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};
