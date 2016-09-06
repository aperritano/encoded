'use strict';
var React = require('react');
var _ = require('underscore');
var {Panel, PanelHeading, PanelBody} = require('../libs/bootstrap/panel');
var globals = require('./globals');
var {StatusLabel} = require('./statuslabel');
var {ProjectBadge} = require('./image');
var {AuditIndicators, AuditDetail, AuditMixin} = require('./audit');
var {DbxrefList} = require('./dbxref');
var {FetchedItems} = require('./fetched');
var {Breadcrumbs} = require('./navigation');
var {TreatmentDisplay} = require('./objectutils');
var {Document, DocumentsPanel, DocumentsSubpanels, DocumentPreview, DocumentFile, AttachmentPanel} = require('./doc');


var PanelLookup = function (props) {
    // XXX not all panels have the same markup
    var context;
    if (props['@id']) {
        context = props;
        props = {context: context, key: context['@id']};
    }
    var PanelView = globals.panel_views.lookup(props.context);
    return <PanelView key={props.context.uuid} {...props} />;
};


var GeneticModification = module.exports.GeneticModification = React.createClass({
    mixins: [AuditMixin],

    render: function() {
        var context = this.props.context;
        var itemClass = globals.itemClass(context, 'view-detail key-value');
        var coords = context.modification_genome_coordinates;

        // Configure breadcrumbs for the page.
        var crumbs = [
            {id: 'Genetic Modifications'}
        ];

        // Collect and combine documents, including from genetic modification characterizations.
        var documents = [];
        if (context.documents && context.documents.length) {
            documents = context.documents;
        }
        if (context.characterizations && context.characterizations.length) {
            context.characterizations.forEach(characterization => {
                if (characterization.documents && characterization.documents.length) {
                    documents = documents.concat(characterization.documents);
                }
            });
        }
        if (documents.length) {
            documents = globals.uniqueObjectsArray(documents);
        }

        return (
            <div className={globals.itemClass(context, 'view-item')}>
                <header className="row">
                    <div className="col-sm-12">
                        <Breadcrumbs root='/search/?type=GeneticModification' crumbs={crumbs} />
                        <h2>{context.modification_type}</h2>
                        <div className="status-line">
                            <div className="characterization-status-labels">
                                <StatusLabel title="Status" status={context.status} />
                            </div>
                            <AuditIndicators audits={context.audit} id="genetic-modification-audit" />
                        </div>
                    </div>
                </header>
                <AuditDetail context={context} id="genetic-modification-audit" />
                <Panel addClasses="data-display">
                    <PanelBody addClasses="panel-body-with-header">
                        <div className="flexrow">
                            <div className="flexcol-sm-6">
                                <div className="flexcol-heading experiment-heading"><h4>Summary</h4></div>
                                <dl className={itemClass}>
                                    {context.modification_description ?
                                        <div data-test="description">
                                            <dt>Description</dt>
                                            <dd>{context.modification_description}</dd>
                                        </div>
                                    : null}

                                    {context.modification_purpose ?
                                        <div data-test="purpose">
                                            <dt>Modification purpose</dt>
                                            <dd>{context.modification_purpose}</dd>
                                        </div>
                                    : null}

                                    {context.modification_zygocity ?
                                        <div data-test="zygocity">
                                            <dt>Modification zygocity</dt>
                                            <dd>{context.modification_zygocity}</dd>
                                        </div>
                                    : null}

                                    {context.url ?
                                        <div data-test="url">
                                            <dt>Product ID</dt>
                                            <dd><a href={context.url}>{context.product_id ? context.product_id : context.url}</a></dd>
                                        </div>
                                    : null}

                                    {context.target ?
                                        <div data-test="target">
                                            <dt>Target</dt>
                                            <dd><a href={context.target['@id']}>{context.target.label}</a></dd>
                                        </div>
                                    : null}

                                    {coords && coords.assembly ?
                                        <div data-test="coordsassembly">
                                            <dt>Mapping assembly</dt>
                                            <dd>{context.modification_genome_coordinates.assembly}</dd>
                                        </div>
                                    : null}

                                    {coords && coords.chromosome && coords.start && coords.end ?
                                        <div data-test="coordssequence">
                                            <dt>Genomic coordinates</dt>
                                            <dd>chr{coords.chromosome}:{coords.start}-{coords.end}</dd>
                                        </div>
                                    : null}
                                </dl>

                                {context.modification_treatments && context.modification_treatments.length ?
                                    <section>
                                        <hr />
                                        <h4>Treatment details</h4>
                                        {context.modification_treatments.map(treatment => TreatmentDisplay(treatment))}
                                    </section>
                                : null}

                                {context.modification_techniques && context.modification_techniques.length ?
                                    <section>
                                        <hr />
                                        <h4>Modification techniques</h4>
                                        {GeneticModificationTechniques(context.modification_techniques)}
                                    </section>
                                : null}
                            </div>

                            <div className="flexcol-sm-6">
                                <div className="flexcol-heading experiment-heading">
                                    <h4>Attribution</h4>
                                    <ProjectBadge award={context.award} addClasses="badge-heading" />
                                </div>
                                <dl className="key-value">
                                    <div data-test="lab">
                                        <dt>Lab</dt>
                                        <dd>{context.lab.title}</dd>
                                    </div>

                                    {context.award.pi && context.award.pi.lab ?
                                        <div data-test="awardpi">
                                            <dt>Award PI</dt>
                                            <dd>{context.award.pi.lab.title}</dd>
                                        </div>
                                    : null}

                                    <div data-test="submittedby">
                                        <dt>Submitted by</dt>
                                        <dd>{context.submitted_by.title}</dd>
                                    </div>

                                    {context.source.title ?
                                        <div data-test="sourcetitle">
                                            <dt>Source</dt>
                                            <dd>
                                                {context.source.url ?
                                                    <a href={context.source.url}>{context.source.title}</a>
                                                :
                                                    <span>{context.source.title}</span>
                                                }
                                            </dd>
                                        </div>
                                    : null}

                                    <div data-test="project">
                                        <dt>Project</dt>
                                        <dd>{context.award.project}</dd>
                                    </div>

                                    {context.dbxrefs && context.dbxrefs.length ?
                                        <div data-test="externalresources">
                                            <dt>External resources</dt>
                                            <dd><DbxrefList values={context.dbxrefs} /></dd>
                                        </div>
                                    : null}

                                    {context.aliases.length ?
                                        <div data-test="aliases">
                                            <dt>Aliases</dt>
                                            <dd>{context.aliases.join(", ")}</dd>
                                        </div>
                                    : null}
                                </dl>
                            </div>
                        </div>
                    </PanelBody>
                </Panel>

                {context.characterizations && context.characterizations.length ?
                    <GeneticModificationCharacterizations characterizations={context.characterizations} />
                : null}

                {documents.length ?
                    <DocumentsPanel documentSpecs={[{documents: documents}]} />
                : null}
            </div>
        );
    }
});

globals.content_views.register(GeneticModification, 'GeneticModification');


var GeneticModificationCharacterizations = React.createClass({
    propTypes: {
        characterizations: React.PropTypes.array // Genetic modificiation characterizations to display
    },

    render: function () {
        var {characterizations} = this.props;
        var itemClass = 'view-detail key-value';

        return (
            <Panel>
                <PanelHeading>
                    <h4>Characterizations</h4>
                </PanelHeading>
                <PanelBody>
                    {characterizations.map(characterization => {
                        return <AttachmentPanel context={characterization} attachment={characterization.attachment} title={characterization.characterization_method} />;
                    })}
                </PanelBody>
            </Panel>
        );
    }
});


// Returns array of genetic modification technique components.
var GeneticModificationTechniques = function(techniques) {
    if (techniques && techniques.length) {
        return techniques.map(technique => {
            var ModificationTechniqueView = globals.panel_views.lookup(technique);
            return <ModificationTechniqueView context={technique} />;
        });
    }
    return null;
};


var TechniqueCrispr = React.createClass({
    propTypes: {
        context: React.PropTypes.object // CRISPR genetic modificiation technique to display
    },

    render: function() {
        var {context} = this.props;
        var itemClass = globals.itemClass(context, 'view-detail key-value');

        return (
            <dl className={itemClass}>
                {context.dbxrefs && context.dbxrefs.length ?
                    <div data-test="externalresources">
                        <dt>External resources</dt>
                        <dd><DbxrefList values={context.dbxrefs} /></dd>
                    </div>
                : null}

                {context.insert_sequence ?
                    <div data-test="insertsequence">
                        <dt>Insert sequence</dt>
                        <dd>{context.insert_sequence}</dd>
                    </div>
                : null}
            </dl>
        );
    }
});

globals.panel_views.register(TechniqueCrispr, 'Crispr');


var TechniqueTale = React.createClass({
    propTypes: {
        context: React.PropTypes.object // TALE genetic modificiation technique to display
    },

    render: function() {
        var {context} = this.props;
        var itemClass = globals.itemClass(context, 'view-detail key-value');

        return (
            <dl className={itemClass}>
                {context.dbxrefs && context.dbxrefs.length ?
                    <div data-test="externalresources">
                        <dt>External resources</dt>
                        <dd><DbxrefList values={context.dbxrefs} /></dd>
                    </div>
                : null}

                <div data-test="rvdsequence">
                    <dt>RVD sequence</dt>
                    <dd>{context.RVD_sequence}</dd>
                </div>

                <div data-test="talenplatform">
                    <dt>TALEN platform</dt>
                    <dd>{context.talen_platform}</dd>
                </div>
            </dl>
        );
    }
});

globals.panel_views.register(TechniqueTale, 'Tale');
