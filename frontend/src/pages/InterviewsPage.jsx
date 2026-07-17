import React from 'react';
import { Navigate } from 'react-router-dom';

/**
 * InterviewsPage — Sprint 1 shipped a two-card General/Project picker at
 * this route. Sprint 5 Commit 2 replaces that with a proper Interview Hub
 * at /interviews/new. This file now exists solely to redirect the legacy
 * URL so bookmarks, in-app links, and ⌘K history entries keep working.
 *
 * Deliberately kept as a permanent redirect. Deleting the route would
 * 404 for anyone with the old URL cached; keeping it as a redirect costs
 * nothing.
 */
const InterviewsPage = () => <Navigate to="/interviews/new" replace />;

export default InterviewsPage;
