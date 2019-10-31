import React from 'react';
import PropTypes from 'prop-types';
import pluralize from 'pluralize';
import _ from 'underscore';
import url from 'url';
import QueryString from '../libs/query_string';
import { Panel, PanelBody, TabPanel } from '../libs/ui/panel';
import { svgIcon } from '../libs/svg-icons';
import { tintColor, isLight } from './datacolors';
import DataTable from './datatable';
import * as globals from './globals';
import { MatrixInternalTags } from './objectutils';
import { FacetList, TextFilter, ClearFilters, SearchControls } from './search';


/**
 * Number of subcategory items to show when subcategory isn't expanded.
 * @constant
 */
const SUB_CATEGORY_SHORT_SIZE = 10;


/**
 * Maximum number of selected items that can be visualized.
 * @constant
 */
const VISUALIZE_LIMIT = 500;


/**
 * Render the expander button for a row category, and react to clicks by calling the parent to
 * render the expansion change.
 */
class RowCategoryExpander extends React.Component {
    constructor() {
        super();
        this.handleClick = this.handleClick.bind(this);
    }

    /**
     * Called when the user clicks the expander button to expand or collapse the section.
     */
    handleClick() {
        this.props.expanderClickHandler(this.props.categoryName);
    }

    render() {
        const { categoryId, expanderColor, expanderBgColor, expanded } = this.props;
        return (
            <button
                className="matrix__category-expander"
                aria-expanded={expanded}
                aria-controls={categoryId}
                onClick={this.handleClick}
                style={{ backgroundColor: expanderBgColor }}
            >
                {svgIcon(expanded ? 'chevronUp' : 'chevronDown', { fill: expanderColor })}
            </button>
        );
    }
}

RowCategoryExpander.propTypes = {
    /** Unique ID; should match id of expanded element */
    categoryId: PropTypes.string.isRequired,
    /** Category name; gets passed to click handler */
    categoryName: PropTypes.string.isRequired,
    /** Color to draw the icon or text of the expander button */
    expanderColor: PropTypes.string,
    /** Color to draw the background of the expander button */
    expanderBgColor: PropTypes.string,
    /** True if category is currently expanded */
    expanded: PropTypes.bool,
    /** Function to call to handle clicks in the expander button */
    expanderClickHandler: PropTypes.func.isRequired,
};

RowCategoryExpander.defaultProps = {
    expanderColor: '#000',
    expanderBgColor: 'transparent',
    expanded: false,
};


/**
 * Render and handle the free-text search box. After the user presses the return key, this
 * navigates to the current URL plus the given search term.
 */
class SearchFilter extends React.Component {
    constructor() {
        super();
        this.onChange = this.onChange.bind(this);
    }

    onChange(href) {
        this.context.navigate(href);
    }

    render() {
        const { context } = this.props;
        const parsedUrl = url.parse(this.context.location_href);
        const matrixBase = parsedUrl.search || '';
        const matrixSearch = matrixBase + (matrixBase ? '&' : '?');
        const parsed = url.parse(matrixBase, true);
        const queryStringType = parsed.query.type || '';
        const type = pluralize(queryStringType.toLocaleLowerCase());
        return (
            <div className="matrix-general-search">
                <p>Enter search terms to filter the {type} included in the matrix.</p>
                <div className="general-search-entry">
                    <i className="icon icon-search" />
                    <div className="searchform">
                        <TextFilter filters={context.filters} searchBase={matrixSearch} onChange={this.onChange} />
                    </div>
                </div>
            </div>
        );
    }
}

SearchFilter.propTypes = {
    /** Matrix search results object */
    context: PropTypes.object.isRequired,
};

SearchFilter.contextTypes = {
    navigate: PropTypes.func,
    location_href: PropTypes.string,
};


/**
 * Remove spaces from id so it can be accepted as an id by HTML
 *
 * @param {string} id
 * @returns id without space or dash if id is empty
 */
const sanitizeId = id => (id ? `${id.replace(/\s/g, '_')}` : '-');

let _navbarHeight = null;

/**
 * Get height of the navbar
 *
 * @returns height of navbar on first call and restores same value until page is garbage collected
 */
const getNavbarHeight = () => {
    if (_navbarHeight === null) {
        const navbar = document.querySelector('#navbar');
        _navbarHeight = navbar ? navbar.getBoundingClientRect().height : 0;
    }
    return _navbarHeight;
};


// Reference epigenome ategory properties we use.
const ROW_CATEGORY = 'biosample_ontology.classification';
const ROW_SUBCATEGORY = 'biosample_ontology.term_name';
const COL_CATEGORY = 'assay_title';
const COL_SUBCATEGORY = 'target.label';


/**
 * Order that assay_titles should appear along the horizontal axis of the matrix.
 */
const assaySortOrder = [
    'polyA plus RNA-seq',
    'total RNA-seq',
    'small RNA-seq',
    'microRNA-seq',
    'microRNA counts',
    'RNA microarray',
    'DNase-seq',
    'ATAC-seq',
    'WGBS',
    'RRBS',
    'MeDIP-seq',
    'MRE-seq',
    'TF ChIP-seq',
    'Histone ChIP-seq',
];

/**
 * All assay columns to not include in matrix.
 */
const excludedAssays = [
    'Control ChIP-seq',
];


/**
 * Generate a assay:column map that maps from a combined assay and target name to a column index
 * in the matrix. Any determination of column order or inclusion/exclusion happens in this
 * function. It has the form:
 * {
 *   'cat1': {col: 0, category: 'cat1', hasSubcategories: true},
 *   'cat1|subcat1': {col: 1, category: 'cat1', subcategory: 'subcat1'},
 *   'cat1|subcat2': {col: 2, category: 'cat1', subcategory: 'subcat2'},
 *   'cat3': {col: 5, category: 'cat3', hasSubcategories: false},
 *   'cat2': {col: 3, category: 'cat2', hasSubcategories: true},
 *   'cat2|subcat3': {col: 4, category: 'cat2', subcategory: 'subcat3'},
 *   ...
 * }
 * It might seem redundant to have the "category" property in each object keyed by that same
 * property, but that lets us easily sort these objects by column and display the corresponding
 * category string.
 * @param {object} results Experiment search results
 *
 * @return {object} Keyed column header information
 */
const generateColMap = (context) => {
    const colCategory = context.matrix.x.group_by[0];
    const colSubcategory = context.matrix.x.group_by[1];
    const colMap = {};
    let colIndex = 0;

    // Sort column categories according to a specified order, with unspecified items randomly at
    // the end.
    const colCategoryBuckets = context.matrix.x[colCategory].buckets;
    const sortedColCategoryBuckets = _(colCategoryBuckets).sortBy((colCategoryBucket) => {
        const sortIndex = assaySortOrder.indexOf(colCategoryBucket.key);
        return sortIndex >= 0 ? sortIndex : colCategoryBuckets.length;
    });

    // Generate the column map based on the sorted category buckets.
    sortedColCategoryBuckets.forEach((colCategoryBucket) => {
        if (excludedAssays.indexOf(colCategoryBucket.key) === -1) {
            // Sort column subcategories according to their column counts.
            // * Need to look into whether these subcateogry buckets *need* sorting or the back
            // * end already sorts them.
            const colSubcategoryBuckets = colCategoryBucket[colSubcategory].buckets;
            const sortedColSubcategoryBuckets = colSubcategoryBuckets;

            // Add the mapping of "<assay>" key string to column index.
            colMap[colCategoryBucket.key] = { col: colIndex, category: colCategoryBucket.key, hasSubcategories: colSubcategoryBuckets.length > 0 };
            colIndex += 1;

            // Add the mapping of "<assay>|<target>"" key string to column index for those assays that
            // have targets.
            sortedColSubcategoryBuckets.forEach((colSubcategoryBucket) => {
                colMap[`${colCategoryBucket.key}|${colSubcategoryBucket.key}`] = {
                    col: colIndex,
                    category: colCategoryBucket.key,
                    subcategory: colSubcategoryBucket.key,
                };
                colIndex += 1;
            });
        }
    });
    return colMap;
};


/**
 * Display a disabled cell in the matrix. Used to reduce a bit of code per cell when matrices can
 * be very large.
 */
const DisabledCell = () => <div className="matrix__disabled-cell" />;


/**
 * Takes matrix data from JSON and generates an object that <DataTable> can use to generate the JSX
 * for the matrix. This is a shim between the experiment or audit data and the data <DataTable>
 * needs.
 * @param {object} context Matrix JSON for the page
 * @param {array}  expandedRowCategories Names of rowCategories the user has expanded
 * @param {func}   expanderClickHandler Called when the user expands/collapses a row category
 *
 * @return {object} Generated object suitable for passing to <DataTable>
 */

const convertReferenceEpigenomeToDataTable = (context, expandedRowCategories, expanderClickHandler) => {
    const colCategory = context.matrix.x.group_by[0];
    const colSubcategory = context.matrix.x.group_by[1];
    const rowCategory = context.matrix.y.group_by[0];
    const rowSubcategory = context.matrix.y.group_by[1];

    // Generate the mapping of column categories and subcategories.
    const colMap = generateColMap(context);
    const colCount = Object.keys(colMap).length;

    // Convert column map to a sorted array of column labels for displaying in the matrix header.
    // This is an array of the value objects in `colMap`, sorted by their `col` property.
    const sortedCols = Object.keys(colMap).map(assayColKey => colMap[assayColKey]).sort((colInfoA, colInfoB) => colInfoA.col - colInfoB.col);

    // Generate array of column category names for categories that have subcategories, for
    // rendering those columns as disabled.
    const colCategoriesWithSubcategories = Object.keys(colMap).filter(colCategoryName => colMap[colCategoryName].hasSubcategories);

    // Generate the hierarchical top-row sideways header labels. First item is null for the empty
    // upper-left cell. At the end of this loop, rendering `{header}` shows this header row.
    const header = [{ header: null }].concat(sortedCols.map((colInfo) => {
        const catQuery = `${COL_CATEGORY}=${globals.encodedURIComponent(colInfo.category)}`;
        if (!colInfo.subcategory) {
            // Add the category column links.
            return { header: <a href={`${context.search_base}&${catQuery}`}>{colInfo.category}</a> };
        }

        // Add the subcategory column links.
        const subCatQuery = `${COL_SUBCATEGORY}=${globals.encodedURIComponent(colInfo.subcategory)}`;
        return { header: <a className="sub" href={`${context.search_base}&${catQuery}&${subCatQuery}`}>{colInfo.subcategory}</a> };
    }));

    // Generate the main table content including the data hierarchy, where the upper level of the
    // hierarchy gets referred to here as "rowCategory" and the lower-level gets referred to as
    // "rowSubCategory." Both these types of rows get collected into `matrixDataTable`. Also
    // generate an array of React keys to use in with <DataMatrix> using an array index independent
    // of the reduce-loop index because of spacer/expander row insertion.
    let matrixRow = 1;
    const rowKeys = ['column-categories'];
    const rowCategoryBuckets = context.matrix.y[rowCategory].buckets;
    const rowCategoryColors = globals.biosampleTypeColors.colorList(rowCategoryBuckets.map(rowCategoryDatum => rowCategoryDatum.key));
    const dataTable = rowCategoryBuckets.reduce((accumulatingTable, rowCategoryBucket, rowCategoryIndex) => {
        // Each loop iteration generates one category row -- one iteration per top level of the row
        // hierarchy.
        const rowCategoryColor = rowCategoryColors[rowCategoryIndex];
        const rowSubcategoryColor = tintColor(rowCategoryColor, 0.5);
        const rowCategoryTextColor = isLight(rowCategoryColor) ? '#000' : '#fff';
        const rowSubcategoryBuckets = rowCategoryBucket[rowSubcategory].buckets;
        const expandableRowCategory = rowSubcategoryBuckets.length > SUB_CATEGORY_SHORT_SIZE;
        const rowCategoryQuery = `${ROW_CATEGORY}=${globals.encodedURIComponent(rowCategoryBucket.key)}`;

        // Update the row key mechanism.
        rowKeys[matrixRow] = rowCategoryBucket.key;
        matrixRow += 1;

        // Get the list of subcategory names, shortened if the category is isn't expanded.
        const categoryExpanded = expandedRowCategories.indexOf(rowCategoryBucket.key) !== -1;
        const visibleRowSubcategoryBuckets = categoryExpanded ? rowSubcategoryBuckets : rowSubcategoryBuckets.slice(0, SUB_CATEGORY_SHORT_SIZE);

        // Generate one rowCategory's rows of subCategories, adding a header cell for each
        // rowSubCategory on the left of the row.
        const cells = Array(colCount);
        const subcategoryRows = visibleRowSubcategoryBuckets.map((rowSubcategoryBucket) => {
            const subCategoryQuery = `${ROW_SUBCATEGORY}=${globals.encodedURIComponent(rowSubcategoryBucket.key)}`;

            // Generate an array of data cells for a single row subcategory. This might combine the
            // data from multiple reference epigenomes into one subcategory row -- effectively
            // ORing the subcategory data from all reference epigenomes within one subcategory.
            cells.fill(null);
            rowSubcategoryBucket[colCategory].buckets.forEach((rowSubcategoryColCategoryBucket) => {
                if (excludedAssays.indexOf(rowSubcategoryColCategoryBucket.key) === -1) {
                    const rowSubcategoryColSubcategoryBuckets = rowSubcategoryColCategoryBucket[colSubcategory].buckets;
                    if (rowSubcategoryColSubcategoryBuckets.length > 0) {
                        // The column category has subcategories, so put relevant colored cells in the
                        // subcategory columns.
                        rowSubcategoryColSubcategoryBuckets.forEach((cellData) => {
                            const colMapKey = `${rowSubcategoryColCategoryBucket.key}|${cellData.key}`;
                            const colIndex = colMap[colMapKey].col;
                            cells[colIndex] = { content: <div style={{ backgroundColor: rowSubcategoryColor }} /> };
                        });
                    } else {
                        // The column category does not have subcategories, so just add a colored
                        // cell for the column category.
                        const colIndex = colMap[rowSubcategoryColCategoryBucket.key].col;
                        cells[colIndex] = { content: <div style={{ backgroundColor: rowSubcategoryColor }} /> };
                    }
                }
            });

            // Show category columns as disabled (i.e. nothing to see here) if those columns have
            // subcategory columns.
            colCategoriesWithSubcategories.forEach((colCategoryName) => {
                cells[colMap[colCategoryName].col] = { content: <DisabledCell /> };
            });

            // Add a single subcategory row's data and left header to the matrix.
            rowKeys[matrixRow] = `${rowCategoryBucket.key}|${rowSubcategoryBucket.key}`;
            matrixRow += 1;
            return {
                rowContent: [
                    {
                        header: (
                            <a href={`${context.search_base}&${subCategoryQuery}`}>
                                <div className="subcategory-row-text">{rowSubcategoryBucket.key}</div>
                            </a>
                        ),
                    },
                ].concat(cells),
                css: 'matrix__row-data',
            };
        });

        // Generate a row for a rowCategory alone, concatenated with the rowSubcategory rows under it,
        // concatenated with an spacer row that might be empty or might have a rowCategory expander
        // button.
        rowKeys[matrixRow] = `${rowCategoryBucket.key}-spacer`;
        matrixRow += 1;
        const categoryId = sanitizeId(rowKeys[matrixRow]);
        return accumulatingTable.concat(
            [
                {
                    rowContent: [{
                        header: (
                            <div id={categoryId} style={{ backgroundColor: rowCategoryColor }}>
                                {expandableRowCategory ?
                                    <RowCategoryExpander
                                        categoryId={categoryId}
                                        categoryName={rowCategoryBucket.key}
                                        expanderColor={rowCategoryTextColor}
                                        expanded={categoryExpanded}
                                        expanderClickHandler={expanderClickHandler}
                                    />
                                : null}
                                <a href={`${context['@id']}&${rowCategoryQuery}`} style={{ color: rowCategoryTextColor }}>{rowCategoryBucket.key}</a>
                            </div>
                        ),
                    },
                    { content: <div style={{ backgroundColor: rowCategoryColor }} />, colSpan: 0 }],
                    css: 'matrix__row-category',
                },
            ],
            subcategoryRows,
            [{
                rowContent: [
                    {
                        content: (
                            expandableRowCategory ?
                                <RowCategoryExpander
                                    categoryId={categoryId}
                                    categoryName={rowCategoryBucket.key}
                                    expanded={categoryExpanded}
                                    expanderClickHandler={expanderClickHandler}
                                    expanderColor={rowCategoryTextColor}
                                    expanderBgColor={rowCategoryColor}
                                />
                            : null
                        ),
                    },
                    {
                        content: null,
                        colSpan: 0,
                    },
                ],
                css: `matrix__row-spacer${expandableRowCategory ? ' matrix__row-spacer--expander' : ''}`,
            }]
        );
    }, [{ rowContent: header, css: 'matrix__col-category-header' }]);
    return { dataTable, rowKeys };
};


/**
 * Render the title panel and list of experiment internal tags.
 */
const MatrixHeader = ({ context }) => {
    const visualizeDisabledTitle = context.total > VISUALIZE_LIMIT ? `Filter to ${VISUALIZE_LIMIT} to visualize` : '';

    let clearButton;
    const matrixQueryString = url.parse(context['@id']).query;
    if (matrixQueryString) {
        // If we have a 'type' query string term along with other terms, we need a Clear Filters
        // button.
        const matrixQuery = new QueryString(matrixQueryString);
        const nonPersistentTerms = matrixQuery.getNotKeyElements('type');
        clearButton = Object.keys(nonPersistentTerms).length > 0 && matrixQuery.getKeyValues('type').length > 0;
    }

    // Compose a type title for the page if only one type is included in the query string.
    // Currently, only one type is allowed in the query string or the server returns a 400, so this
    // code exists in case more than one type is allowed in future.
    let type = '';
    if (context.filters && context.filters.length > 0) {
        const typeFilters = context.filters.filter(filter => filter.field === 'type');
        if (typeFilters.length === 1) {
            type = typeFilters[0].term;
        }
    }

    return (
        <div className="matrix-header">
            <div className="matrix-header__title">
                <h1>{type ? `${type} ` : ''}{context.title}</h1>
                <div className="matrix-tags">
                    <MatrixInternalTags context={context} />
                </div>
            </div>
            <div className="matrix-header__controls">
                <div className="matrix-header__filter-controls">
                    <ClearFilters searchUri={context.clear_filters} enableDisplay={!!clearButton} />
                    <SearchFilter context={context} />
                </div>
                <div className="matrix-header__search-controls">
                    <h4>Showing {context.total} results</h4>
                    <SearchControls context={context} visualizeDisabledTitle={visualizeDisabledTitle} />
                </div>
            </div>
        </div>
    );
};

MatrixHeader.propTypes = {
    /** Matrix search result object */
    context: PropTypes.object.isRequired,
};


/**
 * Render the vertical facets.
 */
const MatrixVerticalFacets = ({ context }, reactContext) => (
    <FacetList
        facets={context.facets}
        filters={context.filters}
        searchBase={`${url.parse(reactContext.location_href).search}&` || '?'}
        addClasses="matrix-facets"
    />
);

MatrixVerticalFacets.propTypes = {
    /** Matrix search result object */
    context: PropTypes.object.isRequired,
};

MatrixVerticalFacets.contextTypes = {
    location_href: PropTypes.string,
};


/**
 * Display the matrix and associated controls above them.
 */
class MatrixPresentation extends React.Component {
    constructor(props) {
        super(props);

        // Determine whether a biosample classification has been specified in the query string, and
        // automatically expand the classification section if it has. Also cache the parsed URL and
        // analyzed query string as we need these later in the render.
        this.parsedUrl = url.parse(this.props.context['@id']);
        this.query = new QueryString(this.parsedUrl.query);
        const requestedClassifications = this.query.getKeyValues('biosample_ontology.classification');

        // Gather the biosample classifications actually in the data and filter the requested
        // classifications down to the actual data.
        const classificationBuckets = props.context.matrix.y[props.context.matrix.y.group_by[0]].buckets;
        const actualClassifications = classificationBuckets.map(bucket => bucket.key);
        const filteredClassifications = requestedClassifications.filter(classification => actualClassifications.includes(classification));

        this.state = {
            /** Categories the user has expanded */
            expandedRowCategories: filteredClassifications,
            /** Matrix object for currently selected organism; null for props.context */
            organismContext: null,
            /** True if matrix scrolled all the way to the right; used for flashing arrow */
            scrolledRight: false,
        };
        this.expanderClickHandler = this.expanderClickHandler.bind(this);
        this.handleTabClick = this.handleTabClick.bind(this);
        this.handleOnScroll = this.handleOnScroll.bind(this);
        this.handleScrollIndicator = this.handleScrollIndicator.bind(this);
    }

    componentDidMount() {
        this.handleScrollIndicator(this.scrollElement);
    }

    componentDidUpdate(prevProps) {
        this.handleScrollIndicator(this.scrollElement);

        // If URI changed, we need close any expanded rowCategories in case the URI change results
        // in a huge increase in displayed data.
        if (prevProps.context['@id'] !== this.props.context['@id']) {
            this.setState({ expandedRowCategories: [] });
        }
    }

    /**
     * Called when the user clicks on the expander button on a category to collapse or expand it.
     * @param {string} category Key for the category
     */
    expanderClickHandler(category) {
        this.setState((prevState) => {
            const matchingCategoryIndex = prevState.expandedRowCategories.indexOf(category);
            if (matchingCategoryIndex === -1) {
                // Category doesn't exist in array, so add it.
                return { expandedRowCategories: prevState.expandedRowCategories.concat(category) };
            }

            // Category does exist in array
            // Move close to header
            const header = document.querySelector(`#${sanitizeId(category)}`);
            const headerToPageTopDistance = header ? header.getBoundingClientRect().top : 0;
            const buffer = 20; // extra space between navbar and header
            const top = headerToPageTopDistance - (getNavbarHeight() + buffer);
            window.scrollBy({
                top,
                left: 0,
                behavior: 'smooth',
            });

            // Remove category.
            const expandedCategories = prevState.expandedRowCategories;
            return { expandedRowCategories: [...expandedCategories.slice(0, matchingCategoryIndex), ...expandedCategories.slice(matchingCategoryIndex + 1)] };
        });
    }

    /**
     * Called when the user scrolls the matrix horizontally within its div to handle scroll
     * indicators.
     * @param {object} e React synthetic scroll event
     */
    handleOnScroll(e) {
        this.handleScrollIndicator(e.target);
    }

    /**
     * Show a scroll indicator depending on current scrolled position.
     * @param {object} element DOM element to apply shading to
     */
    handleScrollIndicator(element) {
        if (element) {
            // Have to use a "roughly equal to" test because of an MS Edge bug mentioned here:
            // https://stackoverflow.com/questions/30900154/workaround-for-issue-with-ie-scrollwidth
            const scrollDiff = Math.abs((element.scrollWidth - element.scrollLeft) - element.clientWidth);
            if (scrollDiff < 2 && !this.state.scrolledRight) {
                // Right edge of matrix scrolled into view.
                this.setState({ scrolledRight: true });
            } else if (scrollDiff >= 2 && this.state.scrolledRight) {
                // Right edge of matrix scrolled out of view.
                this.setState({ scrolledRight: false });
            }
        } else if (!this.state.scrolledRight) {
            this.setState({ scrolledRight: true });
        }
    }

    // Handle a click on a tab.
    handleTabClick(tab) {
        const clickedOrganism = tab === 'All organisms' ? '' : tab;
        if (clickedOrganism) {
            this.query.replaceKeyValue('replicates.library.biosample.donor.organism.scientific_name', clickedOrganism);
        } else {
            this.query.deleteKeyValue('replicates.library.biosample.donor.organism.scientific_name');
        }
        this.parsedUrl.search = null;
        this.parsedUrl.query = null;
        const baseMatrixUrl = url.format(this.parsedUrl);
        this.context.navigate(`${baseMatrixUrl}?${this.query.format()}`);
    }

    render() {
        const { context } = this.props;
        const displayedContext = this.state.organismContext || context;
        const { scrolledRight } = this.state;

        // Collect organisms for the tabs. `context` could change at any render, so we need to
        // calculate `organismTabs` every render. `context` does not change with the selected
        // organism tab.
        let availableOrganisms = [];
        const organismTabs = {};
        const organismFacet = context.facets.find(facet => facet.field === 'replicates.library.biosample.donor.organism.scientific_name');
        if (organismFacet) {
            availableOrganisms = organismFacet.terms.map(term => term.key);
            availableOrganisms.forEach((organismName) => {
                organismTabs[organismName] = <i>{organismName}</i>;
            });
        }

        // Determine the currently selected tab from the query string.
        let selectedTab = null;
        const selectedOrganisms = this.query.getKeyValues('replicates.library.biosample.donor.organism.scientific_name');
        if (selectedOrganisms.length === 1) {
            // Query string specifies exactly one organism. Select the corresponding tab if it
            // exists, otherwise don't select a tab.
            selectedTab = availableOrganisms.includes(selectedOrganisms[0]) ? selectedOrganisms[0] : null;
        }

        // Convert encode matrix data to a DataTable object.
        let dataTable;
        let rowKeys;
        let matrixConfig;
        if (selectedTab) {
            ({ dataTable, rowKeys } = convertReferenceEpigenomeToDataTable(displayedContext, this.state.expandedRowCategories, this.expanderClickHandler));
            matrixConfig = {
                rows: dataTable,
                rowKeys,
                tableCss: 'matrix',
            };
        }

        return (
            <div className="matrix__presentation">
                <div className={`matrix__label matrix__label--horz${!scrolledRight ? ' horz-scroll' : ''}`}>
                    <span>{displayedContext.matrix.x.label}</span>
                    {svgIcon('largeArrow')}
                </div>
                <div className="matrix__presentation-content">
                    <div className="matrix__label matrix__label--vert"><div>{svgIcon('largeArrow')}{displayedContext.matrix.y.label}</div></div>
                    <TabPanel tabs={organismTabs} selectedTab={selectedTab} handleTabClick={this.handleTabClick} tabPanelCss="matrix__data-wrapper">
                        {dataTable ?
                            <div className="matrix__data" onScroll={this.handleOnScroll} ref={(element) => { this.scrollElement = element; }}>
                                {matrixConfig ?
                                    <DataTable tableData={matrixConfig} />
                                : null}
                            </div>
                        :
                            <div className="matrix__warning">
                                Select an organism to view data.
                            </div>
                        }
                    </TabPanel>
                </div>
            </div>
        );
    }
}

MatrixPresentation.propTypes = {
    /** Matrix search result object */
    context: PropTypes.object.isRequired,
};

MatrixPresentation.contextTypes = {
    navigate: PropTypes.func,
};


/**
 * Render the vertical facets and the matrix itself.
 */
const MatrixContent = ({ context }) => (
    <div className="matrix__content matrix__content--reference-epigenome">
        <MatrixPresentation context={context} />
    </div>
);

MatrixContent.propTypes = {
    /** Matrix search result object */
    context: PropTypes.object.isRequired,
};


/**
 * View component for the experiment matrix page.
 */
const ReferenceEpigenomeMatrix = ({ context }) => {
    const itemClass = globals.itemClass(context, 'view-item');

    if (context.total > 0) {
        return (
            <Panel addClasses={itemClass}>
                <PanelBody>
                    <MatrixHeader context={context} />
                    <MatrixContent context={context} />
                </PanelBody>
            </Panel>
        );
    }
    return <h4>No results found</h4>;
};

ReferenceEpigenomeMatrix.propTypes = {
    context: PropTypes.object.isRequired,
};

ReferenceEpigenomeMatrix.contextTypes = {
    location_href: PropTypes.string,
    navigate: PropTypes.func,
    biosampleTypeColors: PropTypes.object, // DataColor instance for experiment project
};

globals.contentViews.register(ReferenceEpigenomeMatrix, 'ReferenceEpigenome');
