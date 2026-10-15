import React, { useEffect, useState } from 'react';
import { Info, ChevronDown } from "lucide-react";
import { useNavigate, useParams } from 'react-router-dom';
import { getFeature } from '../api/features';
import '../styles/featureoverview.css';
import '../styles/feature-detail-header.css';

const FeatureOverview = () => {
  const navigate = useNavigate();
  const { featureId } = useParams();
  const [feature, setFeature] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    getFeature(featureId).then((data) => active && setFeature(data)).catch((err) => active && setError(err.message || 'Unable to load feature.'));
    return () => { active = false; };
  }, [featureId]);

  const name = feature?.name || 'Feature';
  const description = feature?.description || '—';
  const code = feature?.feature_code || '—';
  const status = feature?.status || 'Inactive';

  return <div className="feature-overview-page feature-detail-page">
    <section className="feature-detail-header">
      <div className="feature-detail-top">
        <button
           type="button"
             className="feature-detail-back"
             onClick={() => navigate("/features")}
             aria-label="Back to Features"
             title="Back to Features"
             >
            <i className="bi bi-arrow-left" />
           </button>
        <div className="feature-detail-copy"><h1>{name}</h1><p>{description}</p></div>
      </div>
      <nav className="feature-detail-tabs" aria-label="Feature sections">
        <button className="feature-detail-tab active" type="button">Overview</button>
        <button className="feature-detail-tab" type="button" onClick={() => navigate(`/features/${featureId}/store-types`, { state: { feature } })}>Applicable Store Types</button>
        <button className="feature-detail-tab" type="button" onClick={() => navigate(`/features/${featureId}/permissions`, { state: { feature } })}>Permissions</button>
      </nav>
    </section>
    <section className="feature-info-card">
      <div className="feature-info-header"><div className="info-icon-box"><Info size={20} strokeWidth={2.2} /></div><div className="feature-info-title"><h2>Feature Details</h2><p>View feature details.</p></div></div>
      {error && <p role="alert">{error}</p>}
      <div className="feature-info-form">
        <div className="feature-form-row feature-two-columns">
          <div className="feature-field">
            <label>Feature Code</label>
            <div className="feature-readonly-input">{code}</div>
          </div>
          <div className="feature-field">
            <label>Status</label>
            <div className="feature-status-field">
              <div className="feature-status-value"><span className="feature-status-dot" /><span>{status}</span></div>
              <ChevronDown className="feature-status-chevron" size={16} strokeWidth={2} />
            </div>
          </div>
        </div>
        <div className="feature-form-row feature-two-columns feature-details-row">
          <div className="feature-field">
            <label>Feature Name</label>
            <div className="feature-readonly-input">{name}</div>
          </div>
          <div className="feature-field">
            <label>Description</label>
            <div className="feature-description-box">{description}</div>
          </div>
        </div>
      </div>
    </section>
  </div>;
};
export default FeatureOverview;
