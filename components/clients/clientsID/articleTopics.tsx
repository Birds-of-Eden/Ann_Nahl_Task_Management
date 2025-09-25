"use client";

import React, { useState } from "react";
import {
  List as ListIcon,
  FileText,
  Pencil,
  Save,
  X,
  Trash2,
  Plus,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { hasPermissionClient } from "@/lib/permissions-client";
import { useAuth } from "@/context/auth-context";

interface ArticleTopic {
  status: string;
  usedDate: string | null;
  topicname: string;
  usedCount: number;
}

interface ArticleTopicsProps {
  clientData: {
    id: string;
    articleTopics?: ArticleTopic[];
  };
}

const getStatusBadgeClass = (status: string) => {
  switch (status) {
    case "Used":
      return "bg-green-200 text-green-800 dark:bg-green-800/50 dark:text-green-200";
    case "Not yet Used":
      return "bg-yellow-200 text-yellow-800 dark:bg-yellow-800/50 dark:text-yellow-200";
    default:
      return "bg-gray-200 text-gray-800 dark:bg-gray-800/50 dark:text-gray-200";
  }
};

export const ArticleTopics = ({ clientData }: ArticleTopicsProps) => {
  const [topics, setTopics] = useState<ArticleTopic[]>(
    clientData.articleTopics || []
  );
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editedTopic, setEditedTopic] = useState<ArticleTopic | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [newTopic, setNewTopic] = useState<ArticleTopic>({
    topicname: "",
    status: "Not yet Used",
    usedCount: 0,
    usedDate: null,
  });
    const { user } = useAuth();

  // Function to handle enabling inline editing
  const handleEditClick = (topic: ArticleTopic, index: number) => {
    setEditingIndex(index);
    setEditedTopic(topic);
    setIsAdding(false);
  };

  // Function to handle changes in the form inputs for inline editing
  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setEditedTopic((prevTopic) =>
      prevTopic ? { ...prevTopic, [name]: value } : null
    );
  };

  // Function to handle saving the edited topic
  const handleSave = () => {
    if (editedTopic && editingIndex !== null) {
      const updatedTopics = topics.map((topic, index) => {
        if (index === editingIndex) {
          return {
            ...editedTopic,
            usedCount: parseInt(String(editedTopic.usedCount), 10) || 0,
          };
        }
        return topic;
      });
      setTopics(updatedTopics);

      // In a real-world app, you'd make an API call to persist the data here

      setEditingIndex(null);
      setEditedTopic(null);
    }
  };

  // Function to handle canceling the edit
  const handleCancel = () => {
    setEditingIndex(null);
    setEditedTopic(null);
  };

  // Function to handle deleting a topic
  const handleDelete = (indexToDelete: number) => {
    const updatedTopics = topics.filter((_, index) => index !== indexToDelete);
    setTopics(updatedTopics);
  };

  // Function to handle adding a new topic
  const handleAddTopic = async () => {
    // sanitize values
    const sanitized: ArticleTopic = {
      topicname: (newTopic.topicname || "").trim(),
      status: newTopic.status || "Not yet Used",
      usedCount: Number.isFinite(Number(newTopic.usedCount))
        ? Number(newTopic.usedCount)
        : 0,
      usedDate: newTopic.usedDate || null,
    };

    const updatedTopics = [...topics, sanitized];

    // Optimistically update UI
    setTopics(updatedTopics);

    try {
      const res = await fetch(`/api/clients/${clientData.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ articleTopics: updatedTopics }),
      });

      if (!res.ok) {
        throw new Error(`Failed to save: ${res.status}`);
      }

      // Optionally, sync with server response
      const data = await res.json();
      if (Array.isArray(data.articleTopics)) {
        setTopics(data.articleTopics as ArticleTopic[]);
      }

      // Reset form and close modal
      setNewTopic({
        topicname: "",
        status: "Not yet Used",
        usedCount: 0,
        usedDate: null,
      });
      setIsAdding(false);
    } catch (err) {
      console.error(err);
      // Revert optimistic update on error
      setTopics(topics);
      // Keep the modal open so user can retry
    }
  };

  // Function to handle changes in the form inputs for adding
  const handleNewTopicInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setNewTopic((prevTopic) => ({
      ...prevTopic,
      [name]: name === "usedCount" ? (value === "" ? 0 : Number(value)) : value,
    }));
  };

  return (
    <Card className="shadow-lg border-0 bg-white dark:bg-slate-800 lg:col-span-2">
      <CardHeader className="bg-gradient-to-r from-indigo-500/10 to-purple-500/10 dark:from-indigo-500/20 dark:to-purple-500/20">
        <CardTitle className="flex items-center space-x-2">
          <FileText className="h-5 w-5 text-indigo-600" />
          <span>Article Topics</span>
          {topics.length > 0 && (
            <Badge variant="secondary" className="ml-2">
              {topics.length}
            </Badge>
          )}
          <button
            type="button"
            onClick={() => setIsAdding(true)}
            className="ml-auto inline-flex items-center gap-2 rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
            title="Add Topic"
          >
            <Plus size={16} />
            Add Topic
          </button>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        {topics.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full table-auto border-collapse">
              <thead className="text-left text-sm font-medium text-slate-600 dark:text-slate-400">
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <th className="p-3">Article Topic</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Used Count</th>
                  <th className="p-3 whitespace-nowrap">Last Used</th>
                  <th className="p-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {topics.map((topic, index) => (
                  <tr
                    key={index}
                    className="hover:bg-slate-100/50 dark:hover:bg-slate-700/50 transition-colors"
                  >
                    <td className="p-3 text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {editingIndex === index ? (
                        <input
                          type="text"
                          name="topicname"
                          value={editedTopic?.topicname || ""}
                          onChange={handleInputChange}
                          className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-sm p-1"
                        />
                      ) : (
                        topic.topicname || "(Untitled)"
                      )}
                    </td>
                    <td className="p-3">
                      {editingIndex === index ? (
                        <select
                          name="status"
                          value={editedTopic?.status || "Not yet Used"}
                          onChange={handleInputChange}
                          className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-sm p-1"
                        >
                          <option value="Not yet Used">Not yet Used</option>
                          <option value="Used">Used</option>
                        </select>
                      ) : (
                        <Badge
                          className={`font-bold ${getStatusBadgeClass(
                            topic.status
                          )}`}
                        >
                          {topic.status}
                        </Badge>
                      )}
                    </td>
                    <td className="p-3 text-sm text-slate-700 dark:text-slate-300">
                      {editingIndex === index ? (
                        <input
                          type="number"
                          name="usedCount"
                          value={editedTopic?.usedCount ?? 0}
                          onChange={handleInputChange}
                          className="w-20 rounded-md border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-sm p-1"
                        />
                      ) : (
                        topic.usedCount ?? "N/A"
                      )}
                    </td>
                    <td className="p-3 text-sm text-slate-700 dark:text-slate-300 whitespace-nowrap">
                      {editingIndex === index ? (
                        <input
                          type="date"
                          name="usedDate"
                          value={
                            editedTopic?.usedDate
                              ? new Date(editedTopic.usedDate)
                                  .toISOString()
                                  .split("T")[0]
                              : ""
                          }
                          onChange={handleInputChange}
                          className="w-32 rounded-md border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-sm p-1"
                        />
                      ) : topic.usedDate ? (
                        new Date(topic.usedDate).toLocaleDateString()
                      ) : (
                        "N/A"
                      )}
                    </td>
                    <td className="p-3">
                      {editingIndex === index ? (
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={handleSave}
                            className="text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300 transition-colors"
                            title="Save Changes"
                          >
                            <Save size={16} />
                          </button>
                          <button
                            onClick={handleCancel}
                            className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 transition-colors"
                            title="Cancel"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => handleEditClick(topic, index)}
                            className="text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 transition-colors"
                            title="Edit Topic"
                          >
                            <Pencil size={16} />
                          </button>
                          {hasPermissionClient(
                            user?.permissions,
                            "delete_article_topic"
                          ) && (
                            <button
                              onClick={() => handleDelete(index)}
                              className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 transition-colors"
                              title="Delete Topic"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-2 flex-col p-4 text-slate-500 dark:text-slate-400 italic">
            <ListIcon className="h-8 w-8" />
            <p className="text-base">No article topics found.</p>
            <button
              onClick={() => setIsAdding(true)}
              className="mt-4 flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
            >
              <Plus size={16} />
              Add First Topic
            </button>
          </div>
        )}
      </CardContent>

      {/* Add New Topic Modal */}
      {isAdding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-opacity-50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-lg shadow-2xl p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                Add New Topic
              </h2>
              <button
                onClick={() => setIsAdding(false)}
                className="text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
              >
                <X size={24} />
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleAddTopic();
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Topic Name
                </label>
                <textarea
                  name="topicname"
                  value={newTopic.topicname}
                  onChange={handleNewTopicInputChange}
                  className="w-full p-1 rounded-md border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Status
                </label>
                <select
                  name="status"
                  value={newTopic.status}
                  onChange={handleNewTopicInputChange}
                  className="w-full rounded-md border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  required
                >
                  <option value="Not yet Used">Not yet Used</option>
                  <option value="Used">Used</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Used Count
                </label>
                <input
                  type="number"
                  name="usedCount"
                  value={newTopic.usedCount}
                  onChange={handleNewTopicInputChange}
                  className="w-full rounded-md border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                />
              </div>
              <div className="flex justify-end space-x-3 mt-4">
                <button
                  type="button"
                  onClick={() => setIsAdding(false)}
                  className="px-4 py-2 text-sm font-medium rounded-md text-slate-700 dark:text-slate-300 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 transition-colors"
                >
                  Add Topic
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Card>
  );
};
