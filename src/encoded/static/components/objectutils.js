import React from 'react';
import PropTypes from 'prop-types';
import _ from 'underscore';
import url from 'url';
import * as encoding from '../libs/query_encoding';
import { CartToggle } from './cart';
import * as globals from './globals';

// Display information on page as JSON formatted data
export class DisplayAsJson extends React.Component {
    constructor() {
        super();

        // Bind this to non-React methods.
        this.onClick = this.onClick.bind(this);
    }

    onClick() {
        const urlComponents = url.parse(this.context.location_href);
        if (urlComponents.query !== null) {
            window.location.href += '&format=json';
        } else {
            window.location.href += '?format=json';
        }
    }

    render() {
        return (
            <button className="btn btn-info btn-sm" title="Convert page to JSON-formatted data" aria-label="Convert page to JSON-formatted data" onClick={this.onClick}>&#123; ; &#125;</button>
        );
    }
}

DisplayAsJson.contextTypes = {
    location_href: PropTypes.string,
};

export function shadeOverflowOnScroll(e) {
    // shading element that indicates there is further to scroll down
    const bottomShading = e.target.parentNode.getElementsByClassName('shading')[0];
    if (bottomShading) {
        if (e.target.scrollHeight - e.target.scrollTop === e.target.clientHeight) {
            bottomShading.classList.add('hide-shading');
        } else {
            bottomShading.classList.remove('hide-shading');
        }
    }

    // shading element that indicates there is further to scroll up
    const topShading = e.target.parentNode.getElementsByClassName('top-shading')[0];
    if (topShading) {
        if (e.target.scrollTop > 0) {
            topShading.classList.remove('hide-shading');
        } else {
            topShading.classList.add('hide-shading');
        }
    }
}


// Display a summary sentence for a single treatment.
export function singleTreatment(treatment) {
    let treatmentText = '';

    if (treatment.amount) {
        treatmentText += `${treatment.amount}${treatment.amount_units ? ` ${treatment.amount_units}` : ''} `;
    }
    treatmentText += `${treatment.treatment_term_name}${treatment.treatment_term_id ? ` (${treatment.treatment_term_id})` : ''} `;
    if (treatment.duration) {
        let units = '';
        if (treatment.duration_units) {
            units = `${treatment.duration_units}${treatment.duration !== 1 ? 's' : ''}`;
        }
        treatmentText += `for ${treatment.duration}${units ? ` ${units}` : ''}`;
    }
    return treatmentText;
}


// Display a treatment definition list.
export function treatmentDisplay(treatment) {
    const treatmentText = singleTreatment(treatment);
    return (
        <dl key={treatment.uuid} className="key-value">
            <div data-test="treatment">
                <dt>Treatment</dt>
                <dd>{treatmentText}</dd>
            </div>

            <div data-test="type">
                <dt>Type</dt>
                <dd>{treatment.treatment_type}</dd>
            </div>
        </dl>
    );
}


// Do a search of an arbitrary query string passed in the `query` parameter, and return a promise.
// If, for whatever reason, no results could be had, an empty object gets returned from the
// promise.
export function requestSearch(query) {
    return fetch(`/search/?${query}`, {
        method: 'GET',
        headers: {
            Accept: 'application/json',
        },
    }).then((response) => {
        // Convert the response to JSON.
        if (response.ok) {
            return response.json();
        }
        return Promise.resolve(null);
    }).then(responseJson => responseJson || {});
}


// Do a search of the specific objects whose @ids are listed in the `atIds` parameter. Because we
// have to specify the @id of each object in the URL of the GET request, the URL can get quite
// long, so if the number of `atIds` @ids goes beyond the `chunkSize` constant, we break thev
// searches into chunks, and the maximum number of @ids in each chunk is `chunkSize`. We
// then send out all the search GET requests at once, combine them into one array of
// files returned as a promise.
//
// You can also supply an array of objects in the filteringObjects parameter. Any file @ids in
// `atIds` that matches an object['@id'] in `filteringObjects` doesn't get included in the GET
// request.
//
// Note: this function calls `fetch`, so you can't call this function from code that runs on the
// server or it'll complain that `fetch` isn't defined. If called from a React component, make sure
// you only call it when you know the component is mounted, like from the componentDidMount method.
//
// atIds: array of file @ids.
// uri: Base URI specifying the type and statuses of the objects we want to get. The list of object
//      @ids gets added to this URI.
// filteringObjects: Array of files to filter out of the array of file @ids in the fileIds parameter.
export function requestObjects(atIds, uri, filteringObjects) {
    const chunkSize = 100; // Maximum # of files to search for at once
    const filteringFileIds = {}; // @ids of files we've searched for and don't need retrieval
    let filteredObjectIds = {}; // @ids of files we need to retrieve

    // Make a searchable object of file IDs for files to filter out of our list.
    if (filteringObjects && filteringObjects.length > 0) {
        filteringObjects.forEach((filteringObject) => {
            filteringFileIds[filteringObject['@id']] = filteringObject;
        });

        // Filter the given file @ids to exclude those files we already have in data.@graph,
        // just so we don't use bandwidth getting things we already have.
        filteredObjectIds = atIds.filter(atId => !filteringFileIds[atId]);
    } else {
        // The caller didn't supply an array of files to filter out, so filtered files are just
        // all of them.
        filteredObjectIds = atIds;
    }

    // Break fileIds into an array of arrays of <= `chunkSize` @ids so we don't generate search
    // URLs that are too long for the server to handle.
    const objectChunks = [];
    for (let start = 0, chunkIndex = 0; start < filteredObjectIds.length; start += chunkSize, chunkIndex += 1) {
        objectChunks[chunkIndex] = filteredObjectIds.slice(start, start + chunkSize);
    }

    // Going to send out all search chunk GET requests at once, and then wait for all of them to
    // complete.
    return Promise.all(objectChunks.map((objectChunk) => {
        // Build URL containing file search for specific files for each chunk of files.
        const objectUrl = uri.concat(objectChunk.reduce((combined, current) => `${combined}&${encoding.encodedURIComponentOLD('@id')}=${encoding.encodedURIComponentOLD(current)}`, ''));
        return fetch(objectUrl, {
            method: 'GET',
            headers: {
                Accept: 'application/json',
            },
        }).then((response) => {
            // Convert each response response to JSON
            if (response.ok) {
                return response.json();
            }
            return Promise.resolve(null);
        });
    })).then((chunks) => {
        // All search chunks have resolved or errored. We get an array of search results in
        // `chunks` -- one per chunk. Now collect their files from their @graphs into one array of
        // files and return them as the promise result.
        if (chunks && chunks.length > 0) {
            return chunks.reduce((objects, chunk) => (chunk && chunk['@graph'].length > 0 ? objects.concat(chunk['@graph']) : objects), []);
        }

        // Didn't get any good chucks back, so just return no results.
        return [];
    });
}


// Do a search of the specific files whose @ids are listed in the `fileIds` parameter.
//
// You can also supply an array of objects in the filteringFiles parameter. Any file @ids in
// `atIds` that matches an object['@id'] in `filteringFiles` doesn't get included in the GET
// request.
//
// Note: this function calls requestObjects which calls `fetch`, so you can't call this function
// from code that runs on the server or it'll complain that `fetch` isn't defined. If called from a
// React component, make sure you only call it when you know the component is mounted, like from
// the componentDidMount method.
//
// fileIds: array of file @ids.
// filteringFiles: Array of files to filter out of the array of file @ids in the fileIds parameter.
export function requestFiles(fileIds, filteringFiles) {
    return requestObjects(fileIds, '/search/?type=File&limit=all&status!=deleted&status!=revoked&status!=replaced', filteringFiles);
}


// Given a dataset (for now, only ReferenceEpigenome), return the donor diversity of that dataset.
export function donorDiversity(dataset) {
    let diversity = 'none';

    if (dataset.related_datasets && dataset.related_datasets.length > 0) {
        // Get all non-deleted related experiments; empty array if none.
        const experiments = dataset.related_datasets.filter(experiment => experiment.status !== 'deleted');

        // From list list of non-deleted experiments, get all non-deleted replicates into one
        // array.
        if (experiments.length > 0) {
            // Make an array of replicate arrays, one replicate array per experiment. Only include
            // non-deleted replicates.
            const replicatesByExperiment = experiments.map(experiment => (
                (experiment.replicates && experiment.replicates.length > 0) ?
                    experiment.replicates.filter(replicate => replicate.status !== 'deleted')
                : [])
            );

            // Merge all replicate arrays into one non-deleted replicate array.
            const replicates = replicatesByExperiment.reduce((replicateCollection, replicatesForExperiment) => replicateCollection.concat(replicatesForExperiment), []);

            // Look at the donors in each replicate's biosample. If we see at least two different
            // donors, we know we have a composite. If only one unique donor after examining all
            // donors, we have a single. "None" if no donors found in all replicates.
            if (replicates.length > 0) {
                const donorAtIdCollection = [];
                replicates.every((replicate) => {
                    if (replicate.library && replicate.library.status !== 'deleted' &&
                            replicate.library.biosample && replicate.library.biosample.status !== 'deleted' &&
                            replicate.library.biosample.donor && replicate.library.biosample.donor.status !== 'deleted') {
                        const donorAccession = replicate.library.biosample.donor.accession;

                        // If we haven't yet seen this donor @id, add it to our collection
                        if (donorAtIdCollection.indexOf(donorAccession) === -1) {
                            donorAtIdCollection.push(donorAccession);
                        }

                        // If we have two, we know have a composite, and we can exit the loop by
                        // returning false, which makes the replicates.every function end.
                        return donorAtIdCollection.length !== 2;
                    }

                    // No donor to examine in this replicate. Keep the `every` loop going.
                    return true;
                });

                // Now determine the donor diversity.
                if (donorAtIdCollection.length > 1) {
                    diversity = 'composite';
                } else if (donorAtIdCollection.length === 1) {
                    diversity = 'single';
                } // Else keep its original value of 'none'.
            }
        }
    }
    return diversity;
}


// Render the Download icon while allowing the hovering tooltip.
class DownloadIcon extends React.Component {
    constructor() {
        super();

        // Bind this to non-React methods.
        this.onMouseEnter = this.onMouseEnter.bind(this);
        this.onMouseLeave = this.onMouseLeave.bind(this);
    }

    onMouseEnter() {
        this.props.hoverDL(true);
    }

    onMouseLeave() {
        this.props.hoverDL(false);
    }

    render() {
        const { file } = this.props;

        return (
            <i className="icon icon-download" style={!file.restricted ? {} : { opacity: '0.3' }} onMouseEnter={file.restricted ? this.onMouseEnter : null} onMouseLeave={file.restricted ? this.onMouseLeave : null}>
                <span className="sr-only">Download</span>
            </i>
        );
    }
}

DownloadIcon.propTypes = {
    hoverDL: PropTypes.func.isRequired, // Function to call when hovering or stop hovering over the icon
    file: PropTypes.object.isRequired, // File associated with this download button
};


// Render an accession as a button if clicking it sets a graph node, or just as text if not.
const FileAccessionButton = (props) => {
    const { file } = props;
    return <a href={file['@id']} title={`Go to page for ${file.title}`}>{file.title}</a>;
};

FileAccessionButton.propTypes = {
    file: PropTypes.object.isRequired, // File whose button is being rendered
};


// Display a button to open the file information modal.
class FileInfoButton extends React.Component {
    constructor() {
        super();

        // Bind this to non-React methods.
        this.onClick = this.onClick.bind(this);
    }

    onClick() {
        this.props.clickHandler(this.props.file);
    }

    render() {
        return (
            <button className="file-table-btn" onClick={this.onClick}>
                <i className="icon icon-info-circle">
                    <span className="sr-only">Open file information</span>
                </i>
            </button>
        );
    }
}

FileInfoButton.propTypes = {
    file: PropTypes.object.isRequired, // File whose information is to be displayed
    clickHandler: PropTypes.func.isRequired, // Function to call when the info button is clicked
};


// Render a download button for a file that reacts to login state and admin status to render a
// tooltip about the restriction based on those things.
export class RestrictedDownloadButton extends React.Component {
    constructor() {
        super();

        // Set initial object variable values.
        this.timer = null;
        this.tipHovering = false;

        // Set initial React state.
        this.state = {
            tip: false, // True if tip is visible
        };

        // Bind this to non-React methods.
        this.hoverDL = this.hoverDL.bind(this);
        this.hoverTip = this.hoverTip.bind(this);
        this.hoverTipIn = this.hoverTipIn.bind(this);
        this.hoverTipOut = this.hoverTipOut.bind(this);
    }

    hoverDL(hovering) {
        if (hovering) {
            // Started hovering over the DL button; show the tooltip.
            this.setState({ tip: true });

            // If we happen to have a running timer, clear it so we don't clear the tooltip while
            // hovering over the DL button.
            if (this.timer) {
                clearTimeout(this.timer);
                this.timer = null;
            }
        } else {
            // No longer hovering over the DL button; start a timer that might hide the tooltip
            // after a second passes. It won't hide the tooltip if they're now hovering over the
            // tooltip itself.
            this.timer = setTimeout(() => {
                this.timer = null;
                if (!this.tipHovering) {
                    this.setState({ tip: false });
                }
            }, 1000);
        }
    }

    hoverTip(hovering) {
        if (hovering) {
            // Started hovering over the tooltip. This prevents the timer from hiding the tooltip.
            this.tipHovering = true;
        } else {
            // Stopped hovering over the tooltip. If the DL button hover time isn't running, hide
            // the tooltip here.
            this.tipHovering = false;
            if (!this.timer) {
                this.setState({ tip: false });
            }
        }
    }

    hoverTipIn() {
        this.hoverTip(true);
    }

    hoverTipOut() {
        this.hoverTip(false);
    }

    render() {
        const { file } = this.props;
        const tooltipOpenClass = this.state.tip ? ' tooltip-open' : '';
        const buttonEnabled = !(file.restricted || file.no_file_available);

        // If the user provided us with a component for downloading files, add the download
        // properties to the component before rendering.
        const downloadComponent = this.props.downloadComponent ? React.cloneElement(this.props.downloadComponent, {
            file,
            href: file.href,
            download: file.href.substr(file.href.lastIndexOf('/') + 1),
            hoverDL: this.hoverDL,
            buttonEnabled,
        }) : null;

        // Supply a default icon for the user to click to download, if the caller didn't supply one
        // in downloadComponent.
        const icon = (!downloadComponent ? <DownloadIcon file={file} hoverDL={this.hoverDL} /> : null);

        return (
            <div className="dl-tooltip-trigger">
                {buttonEnabled ?
                    <span>
                        {downloadComponent ?
                            <span>{downloadComponent}</span>
                        :
                            <a href={file.href} download={file.href.substr(file.href.lastIndexOf('/') + 1)} data-bypass="true">
                                {icon}
                            </a>
                        }
                    </span>
                :
                    <span>
                        {downloadComponent ?
                            <span>{downloadComponent}</span>
                        :
                            <span>{icon}</span>
                        }
                    </span>
                }
                {file.restricted ?
                    <div className={`tooltip right${tooltipOpenClass}`} role="tooltip" onMouseEnter={this.hoverTipIn} onMouseLeave={this.hoverTipOut}>
                        <div className="tooltip-arrow" />
                        <div className="tooltip-inner">
                            If you are a collaborator or owner of this file,<br />
                            please contact <a href="mailto:encode-help@lists.stanford.edu">encode-help@lists.stanford.edu</a><br />
                            to receive a copy of this file
                        </div>
                    </div>
                : null}
            </div>
        );
    }
}

RestrictedDownloadButton.propTypes = {
    file: PropTypes.object.isRequired, // File containing `href` to use as download link
    downloadComponent: PropTypes.object, // Optional component to render the download button, insetad of default
};

RestrictedDownloadButton.defaultProps = {
    downloadComponent: null,
};


export const DownloadableAccession = (props) => {
    const { file, clickHandler, loggedIn } = props;
    return (
        <span className="file-table-accession">
            <FileAccessionButton file={file} />
            {clickHandler ? <FileInfoButton file={file} clickHandler={clickHandler} /> : null}
            <RestrictedDownloadButton file={file} loggedIn={loggedIn} />
        </span>
    );
};

DownloadableAccession.propTypes = {
    file: PropTypes.object.isRequired, // File whose accession to render
    clickHandler: PropTypes.func, // Function to call when button is clicked
    loggedIn: PropTypes.bool, // True if current user is logged in
};

DownloadableAccession.defaultProps = {
    clickHandler: null,
    loggedIn: false,
};


// Return `true` if the given dataset is viewable by people not logged in, or people logged in
// but not as admin.
export function publicDataset(dataset) {
    return dataset.status === 'released' || dataset.status === 'archived' || dataset.status === 'revoked';
}


// You can use this function to render a panel view for a context object with a couple options:
//   1. Pass an ENCODE context object (e.g. Biosample or Experiment) directly in props. PanelLookup
//      returns a React component that you can render directly.
//
//   2. Pass an object of the form:
//      {
//          context: context object to render
//          ...any other props you want to pass to the panel-rendering component
//      }
//
// Note: this function really doesn't do much of value, but it does do something and it's been
// around since the beginning of encoded, so it stays for now.

export function PanelLookup(properties) {
    let localProps;
    if (properties['@id']) {
        // `properties` is an ENCODE context object, so normalize it by making `props` an object
        // with the given context as an object property.
        localProps = { context: properties };
    } else {
        localProps = properties;
    }

    // `props` is an object with at least { context: ENCODE context object }.
    const PanelView = globals.panelViews.lookup(localProps.context);
    return <PanelView key={localProps.context.uuid} {...localProps} />;
}


// Display the alternate accessions, normally below the header line in objects.
export const AlternateAccession = (props) => {
    const { altAcc } = props;

    if (altAcc && altAcc.length > 0) {
        return (
            <h4 className="replacement-accessions__alternate">
                {altAcc.length === 1 ?
                    <span>Alternate accession: {altAcc[0]}</span>
                :
                    <span>Alternate accessions: {altAcc.join(', ')}</span>
                }
            </h4>
        );
    }

    // No alternate accessions to display.
    return null;
};

AlternateAccession.propTypes = {
    altAcc: PropTypes.array, // Array of alternate accession strings
};

AlternateAccession.defaultProps = {
    altAcc: null,
};


/**
 * Display a list of internal_tags for an object as badges that link to a corresponding search. The
 * object in `context` must have at least one `internal_tags` value or the results are
 * unpredictable.
 */
export const InternalTags = ({ internalTags, objectType, css }) => {
    const tagBadges = internalTags.map((tag) => {
        const tagSearchUrl = `/search/?type=${objectType}&internal_tags=${encoding.encodedURIComponentOLD(tag)}&status=released`;
        return <a href={tagSearchUrl} key={tag}><img src={`/static/img/tag-${tag}.png`} alt={`Search for all ${objectType} with internal tag ${tag}`} /></a>;
    });
    return <span className={css}>{tagBadges}</span>;
};

InternalTags.propTypes = {
    /** Array of internal tags to display */
    internalTags: PropTypes.array.isRequired,
    /** Object @type internal_tags belongs to */
    objectType: PropTypes.string.isRequired,
    /** Optional CSS class to assign to <span> surrounding all the badges */
    css: PropTypes.string,
};

InternalTags.defaultProps = {
    css: '',
};

/**
 * Display image with fallback for non-existent image links
 */
export class ImageWithFallback extends React.Component {
    constructor() {
        super();

        // Initialize image src and alt tags to be empty
        // These should not be set to props values prior to the component mounting or the onError function may not execute for broken image urls on certain browsers (Chrome in particular)
        this.state = {
            imageUrl: '',
            imageAlt: '',
        };
        this.onError = this.onError.bind(this);
    }

    // Only once the component has mounted, update image src and alt tag
    // This ensures that the component mounts and that the onError function will execute for broken image urls
    componentDidMount() {
        this.setState({
            imageUrl: this.props.imageUrl,
            imageAlt: this.props.imageAlt,
        });
    }

    // Display default "not found" image for non-existent image src
    onError() {
        this.setState({
            imageUrl: '/static/img/brokenImage.png',
            imageAlt: 'Not found',
        });
    }

    render() {
        return (
            <img
                onError={this.onError}
                src={this.state.imageUrl}
                alt={this.state.imageAlt}
            />
        );
    }
}

ImageWithFallback.propTypes = {
    imageUrl: PropTypes.string.isRequired,
    imageAlt: PropTypes.string.isRequired,
};


/**
 * Display internal tag badges from search results.
 */
export const MatrixInternalTags = ({ context }) => {
    // Collect filters that are internal_tags.
    const internalTags = _.uniq(context.filters.filter(filter => (
        filter.field === 'internal_tags' && filter.term !== '*'
    )).map(filter => filter.term));
    return internalTags.map(tag => (
        <ImageWithFallback imageUrl={`/static/img/tag-${tag}.png`} imageAlt={`${tag} collection logo`} key={tag} />
    ));
};

MatrixInternalTags.propTypes = {
    /** encode search-results object being displayed */
    context: PropTypes.object.isRequired,
};


/**
 * Given a search results object, extract the type of object that was requested in the query
 * string that generated the search results object and map it to a presentable human-generated
 * object type name from that kind of object's schema. Optionally wrap the name in a given wrapper
 * component. Nothing gets rendered if the search result's query string doesn't specify a
 * "type=anything" or has more than one. The wrapper function must take the form of:
 * "title => <Wrapper>{title}</Wrapper>". Idea for the component wrapping technique from:
 * https://gist.github.com/kitze/23d82bb9eb0baabfd03a6a720b1d637f
 */
export const DocTypeTitle = ({ searchResults, wrapper }, reactContext) => {
    // Determine the search page doc_type title to display at the top of the facet list.
    let facetTitle = '';
    const docTypes = searchResults.filters.length > 0 ? searchResults.filters.filter(searchFilter => searchFilter.field === 'type') : [];
    if (docTypes.length === 1) {
        facetTitle = reactContext.profilesTitles[docTypes[0].term];
    }

    // If one object type was requested, render it *into* the given wrapper component if one was
    // given.
    if (facetTitle) {
        const facetTitleComponent = <span>{facetTitle}</span>;
        return wrapper ? wrapper(facetTitleComponent) : facetTitleComponent;
    }
    return null;
};

DocTypeTitle.propTypes = {
    searchResults: PropTypes.object.isRequired,
    wrapper: PropTypes.func,
};

DocTypeTitle.defaultProps = {
    wrapper: null,
};

DocTypeTitle.contextTypes = {
    profilesTitles: PropTypes.object,
};


/**
 * Display a block of accessory controls on object-display pages, e.g. the audit indicator button.
 */
export const ItemAccessories = ({ item, audit, hasCartControls }, reactContext) => (
    <div className="item-accessories">
        <div className="item-accessories--left">
            {audit ?
                audit.auditIndicators(item.audit, audit.auditId, { session: reactContext.session, sessionProperties: reactContext.session_properties, except: audit.except })
            : null}
        </div>
        <div className="item-accessories--right">
            <DisplayAsJson />
            {hasCartControls ?
                <CartToggle element={item} />
            : null}
        </div>
    </div>
);

ItemAccessories.propTypes = {
    /** Object being displayed that needs these accessories */
    item: PropTypes.object.isRequired,
    /** Audit information */
    audit: PropTypes.shape({
        auditIndicators: PropTypes.func, // Function to display audit indicators
        auditId: PropTypes.string, // Audit HTML ID to use for a11y
        except: PropTypes.string, // Don't link any references to this @id
    }),
    /** True if object has cart controls */
    hasCartControls: PropTypes.bool,
};

ItemAccessories.defaultProps = {
    audit: null,
    hasCartControls: false,
};

ItemAccessories.contextTypes = {
    session: PropTypes.object,
    session_properties: PropTypes.object,
};
